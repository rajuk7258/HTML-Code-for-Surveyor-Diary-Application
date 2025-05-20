// Helper to get DOM elements
const $ = id => document.getElementById(id);

let googleAuth = null;
let statusTimeout;

document.addEventListener('DOMContentLoaded', () => {
    initializeCSV();
    setDefaultDate();
    setDefaultTime();

    $('saveBtn').addEventListener('click', saveData);
    $('downloadAppBtn').addEventListener('click', downloadApp);

    loadGAPI();

    // Google Sign-In/Out handler
    $('googleSignIn').addEventListener('click', handleAuthClick);

    // Optional: Disable save button until all fields are filled
    const requiredFields = ['topic', 'place', 'purpose', 'date', 'time'];
    requiredFields.forEach(id => $(id).addEventListener('input', toggleSaveButton));
    toggleSaveButton();
});

function initializeCSV() {
    try {
        if (!localStorage.getItem('surveyorDiaryCSV')) {
            localStorage.setItem('surveyorDiaryCSV', 'Date,Time,Topic,Place of Going,Purpose of Going,Calendar Event ID\n');
        }
    } catch (e) {
        showStatus('Local storage unavailable. Data won\'t be saved.', 'error');
    }
}

function setDefaultDate() {
    const today = new Date();
    $('date').value = today.toISOString().split('T')[0];
}

function setDefaultTime() {
    const now = new Date();
    let minutes = Math.ceil(now.getMinutes() / 15) * 15;
    if (minutes >= 60) {
        now.setHours(now.getHours() + 1);
        minutes = 0;
    }
    now.setMinutes(minutes);
    now.setSeconds(0, 0);
    $('time').value = now.toTimeString().substring(0, 5);
}

function loadGAPI() {
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = () => gapi.load('client:auth2', initClient);
    document.head.appendChild(script);
}

function initClient() {
    gapi.client.init({
        clientId: '791746441090-o8upq8uiqd71u0kddvqnrjihlukn4fuj.apps.googleusercontent.com',
        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
        scope: 'https://www.googleapis.com/auth/calendar.events'
    }).then(() => {
        googleAuth = gapi.auth2.getAuthInstance();
        $('googleSignIn').style.display = 'block';
        updateGoogleSignInButton();
    });
}

function handleAuthClick() {
    if (!googleAuth) return;
    if (googleAuth.isSignedIn.get()) {
        googleAuth.signOut().then(updateGoogleSignInButton);
    } else {
        googleAuth.signIn()
            .then(() => {
                updateGoogleSignInButton();
                showStatus('Successfully connected to Google Calendar', 'success');
            })
            .catch(err => {
                console.error('Error signing in', err);
                showStatus('Error connecting to Google Calendar', 'error');
            });
    }
}

function updateGoogleSignInButton() {
    if (googleAuth && googleAuth.isSignedIn.get()) {
        $('googleSignIn').textContent = 'Sign out';
    } else {
        $('googleSignIn').textContent = 'Sign in with Google';
    }
}

function toggleSaveButton() {
    const requiredFields = ['topic', 'place', 'purpose', 'date', 'time'];
    const allFilled = requiredFields.every(id => $(id).value.trim() !== '');
    $('saveBtn').disabled = !allFilled;
}

async function saveData() {
    const topic = $('topic').value.trim();
    const place = $('place').value.trim();
    const purpose = $('purpose').value.trim();
    const date = $('date').value;
    const time = $('time').value;

    if (!topic || !place || !purpose || !date || !time) {
        showStatus('Please fill all fields', 'error');
        return;
    }

    const entry = {
        topic,
        place,
        purpose,
        date,
        time,
        timestamp: new Date(`${date}T${time}`).getTime(),
        calendarEventId: null
    };

    try {
        // Google Calendar
        if (googleAuth && googleAuth.isSignedIn.get()) {
            const event = await createCalendarEvent(entry);
            entry.calendarEventId = event.id;
            showStatus('Event added to Google Calendar', 'success');
        }

        // Local reminder
        setLocalReminder(entry);

        // Save to CSV (localStorage)
        safeSetItem('surveyorDiaryCSV', (localStorage.getItem('surveyorDiaryCSV') || '') + createCSVRow(entry));

        showStatus('Entry saved successfully!', 'success');
        clearForm();
        toggleSaveButton();
    } catch (error) {
        console.error('Error saving data:', error);
        showStatus('Error saving entry: ' + (error.message || error), 'error');
    }
}

async function createCalendarEvent(entry) {
    if (!window.gapi || !gapi.client) {
        throw new Error('Google API client not loaded');
    }
    const event = {
        summary: `Survey: ${entry.topic}`,
        location: entry.place,
        description: `Purpose: ${entry.purpose}`,
        start: {
            dateTime: new Date(`${entry.date}T${entry.time}`).toISOString(),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        end: {
            dateTime: new Date(new Date(`${entry.date}T${entry.time}`).getTime() + 3600000).toISOString(),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        reminders: {
            useDefault: false,
            overrides: [
                { method: 'popup', minutes: 30 },
                { method: 'popup', minutes: 10 }
            ]
        }
    };

    const response = await gapi.client.calendar.events.insert({
        calendarId: 'primary',
        resource: event
    });

    return response.result;
}

function setLocalReminder(entry) {
    const MS_30_MIN = 1800000;
    const now = new Date();
    const reminderTime = new Date(`${entry.date}T${entry.time}`);
    const timeDiff = reminderTime - now;

    if (timeDiff > 0) {
        setTimeout(() => {
            showNotification(
                `Survey Reminder: ${entry.topic}`,
                `Place: ${entry.place}\nPurpose: ${entry.purpose}`
            );
        }, timeDiff);

        if (timeDiff > MS_30_MIN) {
            setTimeout(() => {
                showNotification(
                    `Upcoming Survey (30 mins): ${entry.topic}`,
                    `Starts soon at ${entry.time}`
                );
            }, timeDiff - MS_30_MIN);
        }
    } else {
        showStatus('The selected time has already passed. Reminder not set.', 'error');
    }
}

function showNotification(title, body) {
    if (!('Notification' in window)) {
        console.log('This browser does not support notifications');
        return;
    }
    if (Notification.permission === 'granted') {
        new Notification(title, { body });
    } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                new Notification(title, { body });
            } else {
                showStatus('Notifications are blocked by your browser.', 'error');
            }
        });
    }
}

function createCSVRow(entry) {
    // Escape double quotes for CSV
    const escapeCSV = str => `"${(str || '').replace(/"/g, '""')}"`;
    return `${escapeCSV(entry.date)},${escapeCSV(entry.time)},${escapeCSV(entry.topic)},${escapeCSV(entry.place)},${escapeCSV(entry.purpose)},${escapeCSV(entry.calendarEventId || '')}\n`;
}

function safeSetItem(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch (e) {
        showStatus('Unable to save data: localStorage error', 'error');
    }
}

function clearForm() {
    ['topic', 'place', 'purpose'].forEach(id => $(id).value = '');
}

function showStatus(message, type) {
    const statusDiv = $('alarmStatus');
    statusDiv.textContent = message;
    statusDiv.className = type;
    clearTimeout(statusTimeout);
    statusTimeout = setTimeout(() => {
        statusDiv.textContent = '';
        statusDiv.className = '';
    }, 3000);
}


document.addEventListener('DOMContentLoaded', function() {
    // Initialize CSV storage if it doesn't exist
    if (!localStorage.getItem('surveyorDiaryCSV')) {
        localStorage.setItem('surveyorDiaryCSV', 'Date,Time,Topic,Place of Going,Purpose of Going,Calendar Event ID\n');
    }
    
    // Set today's date as default
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    document.getElementById('date').value = dateStr;
    
    // Set current time as default (rounded to next 15 minutes)
    const now = new Date();
    const minutes = Math.ceil(now.getMinutes() / 15) * 15;
    now.setMinutes(minutes);
    if (minutes >= 60) {
        now.setHours(now.getHours() + 1);
        now.setMinutes(0);
    }
    document.getElementById('time').value = now.toTimeString().substring(0, 5);
    
    // Save button click handler
    document.getElementById('saveBtn').addEventListener('click', saveData);
    
    // Download app button click handler
    document.getElementById('downloadAppBtn').addEventListener('click', downloadApp);
    
    // Check for Google API client
    loadGAPI();
});

// Load Google API client
function loadGAPI() {
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = () => {
        gapi.load('client:auth2', initClient);
    };
    document.head.appendChild(script);
}

let googleAuth = null;

function initClient() {
    gapi.client.init({
        clientId: '791746441090-o8upq8uiqd71u0kddvqnrjihlukn4fuj.apps.googleusercontent.com',
        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
        scope: 'https://www.googleapis.com/auth/calendar.events'
    }).then(() => {
        googleAuth = gapi.auth2.getAuthInstance();
        document.getElementById('googleSignIn').style.display = 'block';
    });
}

function handleAuthClick() {
    if (!googleAuth) return;
    
    if (googleAuth.isSignedIn.get()) {
        googleAuth.signOut();
        document.getElementById('googleSignIn').textContent = 'Sign in with Google';
    } else {
        googleAuth.signIn()
            .then(() => {
                document.getElementById('googleSignIn').textContent = 'Sign out';
                showStatus('Successfully connected to Google Calendar', 'success');
            })
            .catch(err => {
                console.error('Error signing in', err);
                showStatus('Error connecting to Google Calendar', 'error');
            });
    }
}

async function saveData() {
    // Get form values
    const topic = document.getElementById('topic').value;
    const place = document.getElementById('place').value;
    const purpose = document.getElementById('purpose').value;
    const date = document.getElementById('date').value;
    const time = document.getElementById('time').value;
    
    // Validate inputs
    if (!topic || !place || !purpose || !date || !time) {
        showStatus('Please fill all fields', 'error');
        return;
    }
    
    // Create entry object
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
        // Add to Google Calendar if signed in
        if (googleAuth && googleAuth.isSignedIn.get()) {
            const event = await createCalendarEvent(entry);
            entry.calendarEventId = event.id;
            showStatus('Event added to Google Calendar', 'success');
        }
        
        // Set local reminder
        setLocalReminder(entry);
        
        // Save to CSV
        saveToCSV(entry);
        
        // Show success message
        showStatus('Entry saved successfully!', 'success');
        
        // Clear form
        document.getElementById('topic').value = '';
        document.getElementById('place').value = '';
        document.getElementById('purpose').value = '';
    } catch (error) {
        console.error('Error saving data:', error);
        showStatus('Error saving entry: ' + error.message, 'error');
    }
}

async function createCalendarEvent(entry) {
    const event = {
        summary: `Survey: ${entry.topic}`,
        location: entry.place,
        description: `Purpose: ${entry.purpose}`,
        start: {
            dateTime: new Date(`${entry.date}T${entry.time}`).toISOString(),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        end: {
            dateTime: new Date(new Date(`${entry.date}T${entry.time}`).getTime() + 3600000).toISOString(), // 1 hour duration
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        reminders: {
            useDefault: false,
            overrides: [
                {method: 'popup', minutes: 30},
                {method: 'popup', minutes: 10}
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
    const now = new Date();
    const reminderTime = new Date(`${entry.date}T${entry.time}`);
    const timeDiff = reminderTime - now;
    
    if (timeDiff > 0) {
        // Set notification for exact time
        setTimeout(() => {
            showNotification(
                `Survey Reminder: ${entry.topic}`,
                `Place: ${entry.place}\nPurpose: ${entry.purpose}`
            );
        }, timeDiff);
        
        // Set notification for 30 minutes before
        if (timeDiff > 1800000) { // 30 minutes in ms
            setTimeout(() => {
                showNotification(
                    `Upcoming Survey (30 mins): ${entry.topic}`,
                    `Starts soon at ${entry.time}`
                );
            }, timeDiff - 1800000);
        }
    } else {
        showStatus('The selected time has already passed. Reminder not set.', 'error');
    }
}

function showNotification(title, body) {
    // Check if notifications are supported
    if (!('Notification' in window)) {
        console.log('This browser does not support notifications');
        return;
    }
    
    // Check if permission is already granted
    if (Notification.permission === 'granted') {
        new Notification(title, { body });
    } 
    // Otherwise, ask for permission
    else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                new Notification(title, { body });
            }
        });
    }
}

function saveToCSV(entry) {
    // Create CSV row
    const csvRow = `"${entry.date}","${entry.time}","${entry.topic}","${entry.place}","${entry.purpose}","${entry.calendarEventId || ''}"\n`;
    
    // Append to existing CSV data in localStorage
    const currentCSV = localStorage.getItem('surveyorDiaryCSV');
    localStorage.setItem('surveyorDiaryCSV', currentCSV + csvRow);
}

function showStatus(message, type) {
    const statusDiv = document.getElementById('alarmStatus');
    statusDiv.textContent = message;
    statusDiv.className = type;
    setTimeout(() => {
        statusDiv.textContent = '';
        statusDiv.className = '';
    }, 3000);
}


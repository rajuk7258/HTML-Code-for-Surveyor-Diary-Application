document.addEventListener('DOMContentLoaded', function() {
    // Initialize CSV storage if it doesn't exist
    if (!localStorage.getItem('surveyorDiaryCSV')) {
        // Create CSV header
        localStorage.setItem('surveyorDiaryCSV', 'Date,Time,Topic,Place of Going,Purpose of Going\n');
    }
    
    // Set today's date as default
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    document.getElementById('date').value = dateStr;
    
    // Save button click handler
    document.getElementById('saveBtn').addEventListener('click', saveData);
    
    // Download app button click handler
    document.getElementById('downloadAppBtn').addEventListener('click', downloadApp);
});

function saveData() {
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
    
    // Create CSV row
    const csvRow = `"${date}","${time}","${topic}","${place}","${purpose}"\n`;
    
    // Append to existing CSV data in localStorage
    const currentCSV = localStorage.getItem('surveyorDiaryCSV');
    localStorage.setItem('surveyorDiaryCSV', currentCSV + csvRow);
    
    // Create entry object for reminder
    const entry = {
        topic,
        place,
        purpose,
        date,
        time,
        timestamp: new Date(`${date}T${time}`).getTime()
    };
    
    // Set reminder alarm
    setReminder(entry);
    
    // Show success message
    showStatus('Entry saved to CSV and reminder set successfully!', 'success');
    
    // Clear form
    document.getElementById('topic').value = '';
    document.getElementById('place').value = '';
    document.getElementById('purpose').value = '';
}

function setReminder(entry) {
    const now = new Date();
    const reminderTime = new Date(`${entry.date}T${entry.time}`);
    const timeDiff = reminderTime - now;
    
    if (timeDiff > 0) {
        setTimeout(() => {
            alert(`REMINDER!\nTopic: ${entry.topic}\nPlace: ${entry.place}\nPurpose: ${entry.purpose}`);
        }, timeDiff);
    } else {
        showStatus('The selected time has already passed. Reminder not set.', 'error');
    }
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


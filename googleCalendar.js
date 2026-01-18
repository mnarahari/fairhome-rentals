const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

// Configuration - UPDATE THESE VALUES
const CREDENTIALS_PATH = path.join(__dirname, 'google-credentials.json');
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'meg.dancedebut@gmail.com';

let calendar = null;

// Initialize Google Calendar API
function initGoogleCalendar() {
    try {
        if (!fs.existsSync(CREDENTIALS_PATH)) {
            console.log('⚠️  Google Calendar: credentials file not found. Calendar sync disabled.');
            console.log('   To enable, add google-credentials.json to your project.');
            return false;
        }

        const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
        
        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/calendar']
        });

        calendar = google.calendar({ version: 'v3', auth });
        console.log('✅ Google Calendar API initialized');
        return true;
    } catch (error) {
        console.error('❌ Google Calendar init error:', error.message);
        return false;
    }
}

// Add reservation to Google Calendar
async function addReservationToCalendar(reservation) {
    if (!calendar) {
        console.log('Google Calendar not configured, skipping...');
        return null;
    }

    if (CALENDAR_ID === 'YOUR_CALENDAR_ID_HERE') {
        console.log('Google Calendar ID not set, skipping...');
        return null;
    }

    try {
        const event = {
            summary: `🏖️ ${reservation.guest_name} - Cloud Nine Reservation`,
            description: `
Guest: ${reservation.guest_name}
Email: ${reservation.guest_email}
Phone: ${reservation.guest_phone || 'Not provided'}

Guests: ${reservation.adults} adults, ${reservation.children} children, ${reservation.infants} infants
Pets: ${reservation.pets}

Pricing:
- Nightly Rate: $${reservation.nightly_rate} x ${reservation.num_nights} nights
- Cleaning Fee: $${reservation.cleaning_fee}
- Service Fee: $${reservation.service_fee || 0}
- Tax (13.5%): $${reservation.tax || 0}
- Total: $${reservation.total_price}

Special Requests: ${reservation.special_requests || 'None'}

Reservation ID: #${reservation.id}
            `.trim(),
            start: {
                date: reservation.check_in,
                timeZone: 'America/Los_Angeles'
            },
            end: {
                date: reservation.check_out,
                timeZone: 'America/Los_Angeles'
            },
            colorId: reservation.status === 'confirmed' ? '10' : '5', // Green for confirmed, Yellow for pending
            reminders: {
                useDefault: false,
                overrides: [
                    { method: 'email', minutes: 24 * 60 }, // 1 day before
                    { method: 'popup', minutes: 60 }       // 1 hour before
                ]
            }
        };

        const response = await calendar.events.insert({
            calendarId: CALENDAR_ID,
            resource: event
        });

        console.log(`✅ Added to Google Calendar: ${response.data.htmlLink}`);
        return response.data;
    } catch (error) {
        console.error('❌ Google Calendar error:', error.message);
        return null;
    }
}

// Update reservation in Google Calendar
async function updateCalendarEvent(eventId, reservation) {
    if (!calendar || !eventId) return null;

    try {
        const event = {
            summary: `🏖️ ${reservation.guest_name} - Cloud Nine Reservation`,
            description: `
Guest: ${reservation.guest_name}
Email: ${reservation.guest_email}
Status: ${reservation.status.toUpperCase()}

Reservation ID: #${reservation.id}
            `.trim(),
            colorId: reservation.status === 'confirmed' ? '10' : 
                     reservation.status === 'cancelled' ? '11' : '5'
        };

        const response = await calendar.events.patch({
            calendarId: CALENDAR_ID,
            eventId: eventId,
            resource: event
        });

        console.log(`✅ Updated Google Calendar event`);
        return response.data;
    } catch (error) {
        console.error('❌ Google Calendar update error:', error.message);
        return null;
    }
}

// Delete event from Google Calendar
async function deleteCalendarEvent(eventId) {
    if (!calendar || !eventId) return false;

    try {
        await calendar.events.delete({
            calendarId: CALENDAR_ID,
            eventId: eventId
        });
        console.log(`✅ Deleted Google Calendar event`);
        return true;
    } catch (error) {
        console.error('❌ Google Calendar delete error:', error.message);
        return false;
    }
}

module.exports = {
    initGoogleCalendar,
    addReservationToCalendar,
    updateCalendarEvent,
    deleteCalendarEvent
};


const test = require('node:test');
const assert = require('node:assert/strict');
const {
    buildAvailabilityEmail,
    buildRunSummaryEmail,
    normalizeEmailList
} = require('../notifier');

const config = {
    notification: {
        to: [
            'mnarahari@gmail.com',
            'anu.narahari@gmail.com'
        ]
    }
};

test('builds no-availability summary email for runs with no available checks', () => {
    const email = buildRunSummaryEmail([
        {
            hotelName: 'Edelweiss',
            location: 'La Fouly',
            date: '2026-08-07',
            available: false,
            reason: 'No Book button was present.',
            checkedAt: '2026-06-20T15:19:00.000Z'
        }
    ], config);

    assert.equal(email.subject, 'No availability');
    assert.deepEqual(email.to, ['mnarahari@gmail.com', 'anu.narahari@gmail.com']);
    assert.match(email.text, /No availability was found/);
    assert.match(email.text, /Edelweiss/);
});

test('builds ASAP summary email when any check is available', () => {
    const email = buildRunSummaryEmail([
        {
            hotelName: 'Auberge Maya-Joie',
            location: 'La Fouly',
            date: '2026-08-07',
            available: true,
            availableSpots: 11,
            bookingUrl: 'https://www.montourdumontblanc.com/en/reservation/maya-joie/20260807',
            reason: 'Book button found.',
            checkedAt: '2026-06-20T15:19:00.000Z'
        }
    ], config);

    assert.equal(email.subject, 'Availability found - act on it ASAP');
    assert.deepEqual(email.to, ['mnarahari@gmail.com', 'anu.narahari@gmail.com']);
    assert.match(email.text, /Available spots: 11/);
    assert.match(email.text, /Booking URL/);
});

test('single availability emails use the configured ASAP subject', () => {
    const email = buildAvailabilityEmail({
        hotelName: 'Auberge Maya-Joie',
        location: 'La Fouly',
        date: '2026-08-07',
        availableSpots: 11,
        bookingUrl: 'https://www.montourdumontblanc.com/en/reservation/maya-joie/20260807',
        sourceUrl: 'https://www.montourdumontblanc.com/en/recherche/',
        reason: 'Book button found.',
        checkedAt: '2026-06-20T15:19:00.000Z'
    }, config);

    assert.equal(email.subject, 'Availability found - act on it ASAP');
});

test('normalizes comma-separated and array email config values', () => {
    assert.deepEqual(
        normalizeEmailList(['mnarahari@gmail.com, anu.narahari@gmail.com']),
        ['mnarahari@gmail.com', 'anu.narahari@gmail.com']
    );
});

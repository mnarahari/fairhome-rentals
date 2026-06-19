const test = require('node:test');
const assert = require('node:assert/strict');
const {
    buildSearchBody,
    dateToDisplayDate,
    parseRefugeCalendar,
    parseSearchResults,
    resolveZoneId,
    runAvailabilityChecks,
    validateConfig
} = require('../availabilityChecker');

const baseCheck = {
    date: '2026-08-07',
    location: 'La Fouly',
    hotelName: 'Edelweiss',
    refugeSlug: 'hotel-edelweiss'
};

test('resolves human-readable locations to TMB zone ids', () => {
    assert.equal(resolveZoneId(baseCheck), '10');
    assert.equal(resolveZoneId({ ...baseCheck, location: 'Champex-Lac' }), '9');
    assert.equal(resolveZoneId({ ...baseCheck, location: 'Argentière / Chamonix Mont-Blanc' }), '4');
});

test('formats dates for TMB rendered pages', () => {
    assert.equal(dateToDisplayDate('2026-08-07'), '07/08/2026');
});

test('builds search POST body from check config', () => {
    const body = buildSearchBody(baseCheck, {
        defaults: {
            comfort: 'INDIV',
            hikers: 4
        }
    });

    assert.equal(body.get('home_recherche[zone]'), '10');
    assert.equal(body.get('home_recherche[arrivee]'), '2026-08-07');
    assert.equal(body.get('home_recherche[confort]'), 'INDIV');
    assert.equal(body.get('home_recherche[voyageurs]'), '4');
});

test('detects search result availability from Book button on matching hotel card', () => {
    const html = `
        <div class="summary-refuge">
            <h3 class="summary-refuge-title">
                <a href="/en/refuges/hotel-edelweiss" title="Hôtel Edelweiss">Hôtel Edelweiss</a>
            </h3>
            <p>2 available spots on 07/08/2026</p>
            <ul>
                <li><span><strong>Location</strong> : LA FOULY</span></li>
            </ul>
            <a href="/en/reservation/hotel-edelweiss/20260807" title="Book">Book</a>
        </div>
    `;

    const result = parseSearchResults(html, baseCheck, {
        baseUrl: 'https://www.montourdumontblanc.com'
    });

    assert.equal(result.available, true);
    assert.equal(result.hotelFound, true);
    assert.equal(result.availableSpots, 2);
    assert.equal(result.bookingUrl, 'https://www.montourdumontblanc.com/en/reservation/hotel-edelweiss/20260807');
});

test('marks matching search card unavailable when Book button is absent', () => {
    const html = `
        <div class="summary-refuge">
            <h3 class="summary-refuge-title">
                <a href="/en/refuges/hotel-edelweiss" title="Hôtel Edelweiss">Hôtel Edelweiss</a>
            </h3>
            <p>Not available for booking on 07/08/2026</p>
            <ul>
                <li><span><strong>Location</strong> : LA FOULY</span></li>
            </ul>
            <a href="/en/refuges/hotel-edelweiss" title="View the guesthouse">View the guesthouse</a>
        </div>
    `;

    const result = parseSearchResults(html, baseCheck);

    assert.equal(result.available, false);
    assert.equal(result.hotelFound, true);
    assert.match(result.reason, /no Book button/i);
});

test('checks refuge calendar links as a direct page fallback', () => {
    const html = `
        <a href="/en/reservation/hotel-edelweiss/20260807" title="07/08/2026">
            <div class="case">
                <div class="date-case"><span>07</span></div>
                <div class="dispo-case bg-warning"><span>2</span></div>
            </div>
        </a>
    `;

    const result = parseRefugeCalendar(html, baseCheck, {
        baseUrl: 'https://www.montourdumontblanc.com'
    });

    assert.equal(result.available, true);
    assert.equal(result.availableSpots, 2);
    assert.equal(result.bookingUrl, 'https://www.montourdumontblanc.com/en/reservation/hotel-edelweiss/20260807');
});

test('validates multi-check config arrays', () => {
    assert.doesNotThrow(() => validateConfig({
        checks: [
            baseCheck,
            {
                date: '2026-08-08',
                location: 'Trient',
                hotelName: 'Auberge Mont-Blanc'
            }
        ]
    }));

    assert.throws(() => validateConfig({ checks: [] }), /at least one/);
});

test('runs all configured checks with injected fetch implementation', async () => {
    const config = {
        defaults: {
            siteBaseUrl: 'https://www.montourdumontblanc.com'
        },
        checks: [
            baseCheck,
            {
                date: '2026-08-08',
                location: 'Trient',
                hotelName: 'Auberge Mont-Blanc'
            }
        ]
    };

    const fetch = async () => ({
        ok: true,
        status: 200,
        url: 'https://www.montourdumontblanc.com/en/recherche/',
        text: async () => `
            <div class="summary-refuge">
                <h3 class="summary-refuge-title"><a title="Hôtel Edelweiss">Hôtel Edelweiss</a></h3>
                <p>1 available spots on 07/08/2026</p>
                <ul><li><strong>Location</strong> : LA FOULY</li></ul>
                <a href="/en/reservation/hotel-edelweiss/20260807" title="Book">Book</a>
            </div>
            <div class="summary-refuge">
                <h3 class="summary-refuge-title"><a title="Auberge Mont-Blanc">Auberge Mont-Blanc</a></h3>
                <p>Not available for booking on 08/08/2026</p>
                <ul><li><strong>Location</strong> : TRIENT</li></ul>
            </div>
        `
    });

    const results = await runAvailabilityChecks(config, { fetch });

    assert.equal(results.length, 2);
    assert.equal(results[0].available, true);
    assert.equal(results[1].available, false);
});

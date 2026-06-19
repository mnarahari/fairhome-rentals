const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const DEFAULT_SITE_BASE_URL = 'https://www.montourdumontblanc.com';

const ZONE_IDS_BY_LOCATION = new Map([
    ['les houches', '6'],
    ['saint gervais', '15'],
    ['saint-gervais', '15'],
    ['les contamines montjoie', '5'],
    ['les contamines-montjoie', '5'],
    ['les chapieux les mottets', '7'],
    ['les chapieux / les mottets', '7'],
    ['courmayeur val veny', '14'],
    ['courmayeur - val veny', '14'],
    ['courmayeur val ferret', '13'],
    ['courmayeur - val ferret', '13'],
    ['la fouly', '10'],
    ['champex lac', '9'],
    ['champex-lac', '9'],
    ['trient', '12'],
    ['vallorcine', '8'],
    ['argentiere chamonix mont blanc', '4'],
    ['argentière / chamonix mont-blanc', '4']
]);

function normalizeText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s/-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

function dateToDisplayDate(date) {
    const [year, month, day] = parseDate(date);
    return `${day}/${month}/${year}`;
}

function dateToReservationDate(date) {
    const [year, month, day] = parseDate(date);
    return `${year}${month}${day}`;
}

function parseDate(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) {
        throw new Error(`Invalid date "${date}". Expected YYYY-MM-DD.`);
    }

    const [year, month, day] = date.split('-');
    return [year, month, day];
}

function createCheckId(check) {
    if (check.id) {
        return check.id;
    }

    return [
        check.date,
        normalizeText(check.location).replace(/\s+/g, '-'),
        normalizeText(check.hotelName).replace(/\s+/g, '-')
    ].join('|');
}

function resolveZoneId(check) {
    if (check.zoneId) {
        return String(check.zoneId);
    }

    const normalizedLocation = normalizeText(check.location);
    const direct = ZONE_IDS_BY_LOCATION.get(normalizedLocation);
    if (direct) {
        return direct;
    }

    for (const [knownLocation, zoneId] of ZONE_IDS_BY_LOCATION.entries()) {
        const normalizedKnownLocation = normalizeText(knownLocation);
        if (
            normalizedKnownLocation.includes(normalizedLocation) ||
            normalizedLocation.includes(normalizedKnownLocation)
        ) {
            return zoneId;
        }
    }

    throw new Error(`No TMB zone ID configured for location "${check.location}". Add "zoneId" to this check.`);
}

function validateConfig(config) {
    if (!config || typeof config !== 'object') {
        throw new Error('TMB config must be an object.');
    }

    if (!Array.isArray(config.checks) || config.checks.length === 0) {
        throw new Error('TMB config must include at least one entry in "checks".');
    }

    for (const [index, check] of config.checks.entries()) {
        for (const field of ['date', 'location', 'hotelName']) {
            if (!check[field]) {
                throw new Error(`TMB check at index ${index} is missing required field "${field}".`);
            }
        }

        parseDate(check.date);
    }
}

function loadConfig(configPath) {
    const resolvedPath = path.resolve(configPath);
    return JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
}

function resolveBaseUrl(config) {
    return config.defaults?.siteBaseUrl || DEFAULT_SITE_BASE_URL;
}

function buildSearchBody(check, config) {
    const defaults = config.defaults || {};
    const body = new URLSearchParams();

    body.set('home_recherche[zone]', resolveZoneId(check));
    body.set('home_recherche[arrivee]', check.date);
    body.set('home_recherche[confort]', check.comfort || defaults.comfort || 'ALL');
    body.set('home_recherche[voyageurs]', String(check.hikers || defaults.hikers || 2));

    return body;
}

async function fetchSearchResultsHtml(check, config, fetchImpl = globalThis.fetch) {
    if (!fetchImpl) {
        throw new Error('No fetch implementation available.');
    }

    const baseUrl = resolveBaseUrl(config);
    const searchUrl = new URL('/en/recherche/', baseUrl).toString();
    const response = await fetchImpl(searchUrl, {
        method: 'POST',
        headers: {
            'content-type': 'application/x-www-form-urlencoded',
            'user-agent': 'TMBAvailabilityChecker/1.0 (+https://www.montourdumontblanc.com/en/)'
        },
        body: buildSearchBody(check, config),
        redirect: 'follow'
    });

    if (!response.ok) {
        throw new Error(`TMB search request failed with HTTP ${response.status}`);
    }

    return {
        html: await response.text(),
        sourceUrl: response.url || searchUrl
    };
}

async function fetchRefugePageHtml(check, config, fetchImpl = globalThis.fetch) {
    if (!fetchImpl) {
        throw new Error('No fetch implementation available.');
    }

    const sourceUrl = resolveRefugeUrl(check, config);
    const response = await fetchImpl(sourceUrl, {
        headers: {
            'user-agent': 'TMBAvailabilityChecker/1.0 (+https://www.montourdumontblanc.com/en/)'
        }
    });

    if (!response.ok) {
        throw new Error(`TMB refuge page request failed with HTTP ${response.status}`);
    }

    return {
        html: await response.text(),
        sourceUrl: response.url || sourceUrl
    };
}

function resolveRefugeUrl(check, config) {
    if (check.refugeUrl) {
        return check.refugeUrl;
    }

    if (!check.refugeSlug) {
        throw new Error(`Check "${createCheckId(check)}" does not include refugeSlug or refugeUrl.`);
    }

    return new URL(`/en/refuges/${check.refugeSlug}`, resolveBaseUrl(config)).toString();
}

function parseSearchResults(html, check, options = {}) {
    const $ = cheerio.load(html);
    const baseUrl = options.baseUrl || DEFAULT_SITE_BASE_URL;
    const wantedHotel = normalizeText(check.hotelName);
    const wantedLocation = normalizeText(check.location);
    const displayDate = dateToDisplayDate(check.date);

    let matchedCard = null;

    $('.summary-refuge').each((_, element) => {
        if (matchedCard) {
            return;
        }

        const card = $(element);
        const hotelName = extractHotelName($, card);
        const normalizedHotelName = normalizeText(hotelName);

        if (!normalizedHotelName.includes(wantedHotel) && !wantedHotel.includes(normalizedHotelName)) {
            return;
        }

        const locationText = extractLocationText($, card);
        const normalizedLocationText = normalizeText(locationText);
        if (locationText && wantedLocation && !normalizedLocationText.includes(wantedLocation)) {
            return;
        }

        matchedCard = card;
    });

    if (!matchedCard) {
        return baseResult(check, {
            available: false,
            hotelFound: false,
            method: 'search-results',
            reason: `No search result matched "${check.hotelName}" in "${check.location}".`
        });
    }

    const bookLink = findBookLink($, matchedCard);
    const statusText = normalizeWhitespace(matchedCard.text());

    return baseResult(check, {
        available: Boolean(bookLink),
        hotelFound: true,
        method: 'search-results',
        reason: bookLink
            ? `Book button found for ${dateToDisplayDate(check.date)}.`
            : `Hotel found, but no Book button was present for ${dateToDisplayDate(check.date)}.`,
        bookingUrl: bookLink ? absoluteUrl(bookLink.attribs.href, baseUrl) : null,
        availableSpots: extractAvailableSpots(statusText),
        sourceStatusText: statusText
    });
}

function parseRefugeCalendar(html, check, options = {}) {
    const $ = cheerio.load(html);
    const baseUrl = options.baseUrl || DEFAULT_SITE_BASE_URL;
    const displayDate = dateToDisplayDate(check.date);
    const cell = $(`a[title="${displayDate}"]`).first();

    if (!cell.length) {
        return baseResult(check, {
            available: false,
            hotelFound: true,
            method: 'refuge-calendar',
            reason: `No calendar cell found for ${displayDate}.`
        });
    }

    const href = cell.attr('href');
    const hasReservationLink = Boolean(href && href.includes('/reservation/'));
    const spotsText = normalizeWhitespace(cell.find('.dispo-case').text());

    return baseResult(check, {
        available: hasReservationLink,
        hotelFound: true,
        method: 'refuge-calendar',
        reason: hasReservationLink
            ? `Reservation link found for ${displayDate}.`
            : `Calendar cell found for ${displayDate}, but it is not bookable.`,
        bookingUrl: hasReservationLink ? absoluteUrl(href, baseUrl) : null,
        availableSpots: extractAvailableSpots(spotsText) || extractInteger(spotsText),
        sourceStatusText: spotsText
    });
}

async function checkAvailability(check, config, dependencies = {}) {
    const method = check.method || config.defaults?.method || 'search';
    const fetchImpl = dependencies.fetch || globalThis.fetch;
    const baseUrl = resolveBaseUrl(config);

    if (method === 'refuge-calendar') {
        const refugePage = await fetchRefugePageHtml(check, config, fetchImpl);
        return {
            ...parseRefugeCalendar(refugePage.html, check, { baseUrl }),
            sourceUrl: refugePage.sourceUrl
        };
    }

    const searchResults = await fetchSearchResultsHtml(check, config, fetchImpl);
    const searchResult = {
        ...parseSearchResults(searchResults.html, check, { baseUrl }),
        sourceUrl: searchResults.sourceUrl
    };

    if (
        !searchResult.hotelFound &&
        (check.refugeSlug || check.refugeUrl) &&
        check.fallbackToRefugePage !== false
    ) {
        const refugePage = await fetchRefugePageHtml(check, config, fetchImpl);
        return {
            ...parseRefugeCalendar(refugePage.html, check, { baseUrl }),
            sourceUrl: refugePage.sourceUrl
        };
    }

    return searchResult;
}

async function runAvailabilityChecks(config, dependencies = {}) {
    validateConfig(config);

    const results = [];
    for (const check of config.checks) {
        try {
            results.push(await checkAvailability(check, config, dependencies));
        } catch (error) {
            results.push(baseResult(check, {
                available: false,
                hotelFound: false,
                method: check.method || config.defaults?.method || 'search',
                reason: error.message,
                error: true
            }));
        }
    }

    return results;
}

function baseResult(check, overrides = {}) {
    return {
        checkId: createCheckId(check),
        date: check.date,
        location: check.location,
        hotelName: check.hotelName,
        available: false,
        hotelFound: false,
        method: null,
        reason: null,
        bookingUrl: null,
        availableSpots: null,
        sourceUrl: null,
        sourceStatusText: null,
        checkedAt: new Date().toISOString(),
        ...overrides
    };
}

function extractHotelName($, card) {
    return normalizeWhitespace(
        card.find('.summary-refuge-title a').first().text() ||
        card.find('.summary-refuge-img-link').first().attr('title') ||
        card.find('h3').first().text()
    );
}

function extractLocationText($, card) {
    let locationText = '';
    card.find('li').each((_, element) => {
        const text = normalizeWhitespace($(element).text());
        if (/location/i.test(text)) {
            locationText = text.replace(/location\s*:/i, '').trim();
        }
    });

    return locationText;
}

function findBookLink($, card) {
    const links = card.find('a').toArray();
    return links.find((link) => {
        const element = $(link);
        const text = normalizeText(element.text());
        const title = normalizeText(element.attr('title'));
        const href = String(element.attr('href') || '');

        return text === 'book' || title === 'book' || href.includes('/reservation/');
    });
}

function extractAvailableSpots(text) {
    const match = String(text || '').match(/(\d+)\s+available\s+spots?/i);
    return match ? Number(match[1]) : null;
}

function extractInteger(text) {
    const match = String(text || '').match(/\d+/);
    return match ? Number(match[0]) : null;
}

function normalizeWhitespace(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
}

function absoluteUrl(href, baseUrl) {
    if (!href) {
        return null;
    }

    return new URL(String(href).trim(), baseUrl).toString();
}

module.exports = {
    DEFAULT_SITE_BASE_URL,
    ZONE_IDS_BY_LOCATION,
    normalizeText,
    dateToDisplayDate,
    dateToReservationDate,
    createCheckId,
    resolveZoneId,
    validateConfig,
    loadConfig,
    buildSearchBody,
    parseSearchResults,
    parseRefugeCalendar,
    checkAvailability,
    runAvailabilityChecks
};

const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

class ConsoleNotifier {
    async send(result, config) {
        const email = buildAvailabilityEmail(result, config);
        console.log(`[dry-run] Would send email to ${email.to.join(', ')}: ${email.subject}`);
        console.log(email.text);
    }

    async sendSummary(results, config) {
        const email = buildRunSummaryEmail(results, config);
        console.log(`[dry-run] Would send email to ${email.to.join(', ')}: ${email.subject}`);
        console.log(email.text);
    }
}

class SesEmailNotifier {
    constructor({ sourceEmail, client } = {}) {
        if (!sourceEmail) {
            throw new Error('SesEmailNotifier requires sourceEmail.');
        }

        this.sourceEmail = sourceEmail;
        this.client = client || new SESClient({});
    }

    async send(result, config) {
        const email = buildAvailabilityEmail(result, config);
        await this.sendEmail(email);
    }

    async sendSummary(results, config) {
        const email = buildRunSummaryEmail(results, config);
        await this.sendEmail(email);
    }

    async sendEmail(email) {
        await this.client.send(new SendEmailCommand({
            Source: this.sourceEmail,
            Destination: {
                ToAddresses: email.to
            },
            Message: {
                Subject: {
                    Data: email.subject,
                    Charset: 'UTF-8'
                },
                Body: {
                    Text: {
                        Data: email.text,
                        Charset: 'UTF-8'
                    }
                }
            }
        }));
    }
}

function buildRunSummaryEmail(results, config) {
    const to = getNotificationRecipients(config);
    const availableResults = results.filter((result) => result.available);
    const hasAvailability = availableResults.length > 0;
    const subject = hasAvailability ? 'Availability found - act on it ASAP' : 'No availability';
    const checkedAt = results[0]?.checkedAt || new Date().toISOString();
    const lines = [
        hasAvailability
            ? 'Availability was found for one or more configured Tour du Mont Blanc refuge checks.'
            : 'No availability was found for the configured Tour du Mont Blanc refuge checks.',
        '',
        `Checked at: ${checkedAt}`,
        `Configured checks: ${results.length}`,
        `Available checks: ${availableResults.length}`,
        '',
        'Results:',
        ...results.flatMap(formatResultLines)
    ];

    return {
        to,
        subject,
        text: lines.join('\n')
    };
}

function buildAvailabilityEmail(result, config) {
    const to = getNotificationRecipients(config);
    const subject = 'Availability found - act on it ASAP';
    const lines = [
        'Availability found for a configured Tour du Mont Blanc refuge check.',
        '',
        `Hotel: ${result.hotelName}`,
        `Location: ${result.location}`,
        `Date: ${result.date}`,
        result.availableSpots ? `Available spots: ${result.availableSpots}` : null,
        '',
        result.reason,
        '',
        result.bookingUrl ? `Booking URL: ${result.bookingUrl}` : 'Open: https://www.montourdumontblanc.com/en/',
        result.sourceUrl ? `Source URL: ${result.sourceUrl}` : null,
        '',
        `Checked at: ${result.checkedAt}`
    ].filter(Boolean);

    return {
        to,
        subject,
        text: lines.join('\n')
    };
}

function formatResultLines(result) {
    const status = result.available ? 'AVAILABLE' : 'unavailable';
    return [
        `- ${status}: ${result.hotelName} | ${result.location} | ${result.date}`,
        `  Reason: ${result.reason}`,
        result.availableSpots ? `  Available spots: ${result.availableSpots}` : null,
        result.bookingUrl ? `  Booking URL: ${result.bookingUrl}` : null,
        result.sourceUrl ? `  Source URL: ${result.sourceUrl}` : null
    ].filter(Boolean);
}

function getNotificationRecipients(config) {
    const to = normalizeEmailList(config.notification?.to || process.env.NOTIFICATION_EMAIL);
    if (to.length === 0) {
        throw new Error('No notification recipients configured.');
    }

    return to;
}

function normalizeEmailList(value) {
    if (!value) {
        return [];
    }

    if (Array.isArray(value)) {
        return value.flatMap(normalizeEmailList);
    }

    return String(value)
        .split(',')
        .map((email) => email.trim())
        .filter(Boolean);
}

module.exports = {
    ConsoleNotifier,
    SesEmailNotifier,
    buildRunSummaryEmail,
    buildAvailabilityEmail,
    normalizeEmailList
};

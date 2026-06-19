const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

class ConsoleNotifier {
    async send(result, config) {
        const email = buildAvailabilityEmail(result, config);
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

function buildAvailabilityEmail(result, config) {
    const to = normalizeEmailList(config.notification?.to || process.env.NOTIFICATION_EMAIL);
    if (to.length === 0) {
        throw new Error('No notification recipients configured.');
    }

    const subject = `TMB refuge availability found: ${result.hotelName}, ${result.location}, ${result.date}`;
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
    buildAvailabilityEmail,
    normalizeEmailList
};

#!/usr/bin/env node

const path = require('path');
const { loadConfig, runAvailabilityChecks } = require('./availabilityChecker');
const { ConsoleNotifier, SesEmailNotifier } = require('./notifier');
const { MemoryStateStore, nextStateForResult, shouldNotify } = require('./state');

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const configPath = args.config || path.join(__dirname, 'checks.json');
    const config = loadConfig(configPath);

    if (args.email) {
        config.notification = config.notification || {};
        config.notification.to = args.email;
    }

    const results = await runAvailabilityChecks(config);
    printResults(results);

    if (!args.sendEmail) {
        return;
    }

    const sourceEmail = args.fromEmail || process.env.NOTIFICATION_FROM_EMAIL || process.env.NOTIFICATION_EMAIL;
    const notifier = args.dryRun
        ? new ConsoleNotifier()
        : new SesEmailNotifier({ sourceEmail });
    const stateStore = new MemoryStateStore();

    for (const result of results) {
        const previousState = await stateStore.get(result.checkId);
        const notify = shouldNotify(result, previousState, {
            renotifyAfterHours: config.notification?.renotifyAfterHours
        });

        if (notify) {
            await notifier.send(result, config);
        }

        await stateStore.put(result.checkId, nextStateForResult(result, notify, previousState || {}));
    }
}

function parseArgs(args) {
    const parsed = {
        dryRun: true,
        sendEmail: false
    };

    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        if (arg === '--config') {
            parsed.config = args[++index];
        } else if (arg === '--email') {
            parsed.email = args[++index];
        } else if (arg === '--from-email') {
            parsed.fromEmail = args[++index];
        } else if (arg === '--send-email') {
            parsed.sendEmail = true;
            parsed.dryRun = false;
        } else if (arg === '--dry-run') {
            parsed.sendEmail = true;
            parsed.dryRun = true;
        } else if (arg === '--help' || arg === '-h') {
            printHelp();
            process.exit(0);
        } else {
            throw new Error(`Unknown argument: ${arg}`);
        }
    }

    return parsed;
}

function printResults(results) {
    for (const result of results) {
        const status = result.available ? 'AVAILABLE' : 'unavailable';
        console.log(`${status}: ${result.hotelName} | ${result.location} | ${result.date}`);
        console.log(`  ${result.reason}`);
        if (result.bookingUrl) {
            console.log(`  ${result.bookingUrl}`);
        }
    }
}

function printHelp() {
    console.log(`
Usage: node tmb/run.js [options]

Options:
  --config <path>       Path to the TMB check config JSON file.
  --dry-run             Print email notifications that would be sent.
  --send-email          Send SES emails for available checks.
  --email <address>     Override notification recipient address(es).
  --from-email <addr>   Override SES source address.
  --help                Show this help.
`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});

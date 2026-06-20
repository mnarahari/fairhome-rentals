const path = require('path');
const { loadConfig, runAvailabilityChecks } = require('./availabilityChecker');
const { ConsoleNotifier, SesEmailNotifier } = require('./notifier');
const { DynamoDbStateStore, MemoryStateStore, nextStateForResult } = require('./state');

const DEFAULT_CONFIG_PATH = path.join(__dirname, 'checks.json');

async function handler() {
    const config = loadRuntimeConfig();
    applyEnvironmentOverrides(config);

    const stateStore = process.env.TMB_STATE_TABLE_NAME
        ? new DynamoDbStateStore({ tableName: process.env.TMB_STATE_TABLE_NAME })
        : new MemoryStateStore();

    const notifier = process.env.DRY_RUN === 'true'
        ? new ConsoleNotifier()
        : new SesEmailNotifier({ sourceEmail: process.env.NOTIFICATION_FROM_EMAIL || process.env.NOTIFICATION_EMAIL });

    const results = await runAvailabilityChecks(config);
    await notifier.sendSummary(results, config);

    for (const result of results) {
        const previousState = await stateStore.get(result.checkId);

        await stateStore.put(
            result.checkId,
            nextStateForResult(result, true, previousState || {})
        );
    }

    return {
        statusCode: 200,
        body: JSON.stringify({
            checked: results.length,
            available: results.filter((result) => result.available).length,
            notificationsSent: 1,
            notificationSubject: results.some((result) => result.available)
                ? 'Availability found - act on it ASAP'
                : 'No availability',
            results
        })
    };
}

function loadRuntimeConfig() {
    if (process.env.TMB_CHECK_CONFIG_JSON) {
        return JSON.parse(process.env.TMB_CHECK_CONFIG_JSON);
    }

    return loadConfig(process.env.TMB_CHECK_CONFIG_PATH || DEFAULT_CONFIG_PATH);
}

function applyEnvironmentOverrides(config) {
    config.notification = config.notification || {};

    if (process.env.NOTIFICATION_EMAIL) {
        config.notification.to = process.env.NOTIFICATION_EMAIL;
    }

    if (process.env.RENOTIFY_AFTER_HOURS) {
        config.notification.renotifyAfterHours = Number(process.env.RENOTIFY_AFTER_HOURS);
    }
}

module.exports = {
    handler,
    loadRuntimeConfig,
    applyEnvironmentOverrides
};

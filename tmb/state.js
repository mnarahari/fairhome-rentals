const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');

class MemoryStateStore {
    constructor(initialState = {}) {
        this.state = new Map(Object.entries(initialState));
    }

    async get(checkId) {
        return this.state.get(checkId) || null;
    }

    async put(checkId, value) {
        this.state.set(checkId, value);
    }
}

class DynamoDbStateStore {
    constructor({ tableName, client } = {}) {
        if (!tableName) {
            throw new Error('DynamoDbStateStore requires tableName.');
        }

        this.tableName = tableName;
        this.client = DynamoDBDocumentClient.from(client || new DynamoDBClient({}));
    }

    async get(checkId) {
        const response = await this.client.send(new GetCommand({
            TableName: this.tableName,
            Key: { checkId }
        }));

        return response.Item || null;
    }

    async put(checkId, value) {
        await this.client.send(new PutCommand({
            TableName: this.tableName,
            Item: {
                checkId,
                ...value,
                updatedAt: new Date().toISOString()
            }
        }));
    }
}

function shouldNotify(result, previousState, options = {}) {
    if (!result.available) {
        return false;
    }

    if (!previousState || previousState.lastStatus !== 'available') {
        return true;
    }

    const renotifyAfterHours = Number(options.renotifyAfterHours || 0);
    if (!renotifyAfterHours || !previousState.lastNotifiedAt) {
        return false;
    }

    const elapsedMs = Date.now() - Date.parse(previousState.lastNotifiedAt);
    return elapsedMs >= renotifyAfterHours * 60 * 60 * 1000;
}

function nextStateForResult(result, didNotify, previousState = {}) {
    return {
        lastStatus: result.available ? 'available' : 'unavailable',
        lastCheckedAt: result.checkedAt,
        lastNotifiedAt: didNotify
            ? new Date().toISOString()
            : previousState.lastNotifiedAt || null,
        lastBookingUrl: result.bookingUrl || previousState.lastBookingUrl || null,
        lastReason: result.reason || null
    };
}

module.exports = {
    MemoryStateStore,
    DynamoDbStateStore,
    shouldNotify,
    nextStateForResult
};

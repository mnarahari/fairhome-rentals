const test = require('node:test');
const assert = require('node:assert/strict');
const {
    MemoryStateStore,
    nextStateForResult,
    shouldNotify
} = require('../state');

test('notifies when a check first becomes available', () => {
    assert.equal(shouldNotify({ available: true }, null), true);
});

test('does not notify repeatedly while still available within renotify window', () => {
    assert.equal(shouldNotify(
        { available: true },
        {
            lastStatus: 'available',
            lastNotifiedAt: new Date().toISOString()
        },
        { renotifyAfterHours: 24 }
    ), false);
});

test('renotifies available checks after configured interval', () => {
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    assert.equal(shouldNotify(
        { available: true },
        {
            lastStatus: 'available',
            lastNotifiedAt: twoDaysAgo
        },
        { renotifyAfterHours: 24 }
    ), true);
});

test('records independent state by check id', async () => {
    const store = new MemoryStateStore();
    await store.put('edelweiss-la-fouly-2026-08-07', { lastStatus: 'available' });
    await store.put('auberge-mont-blanc-trient-2026-08-08', { lastStatus: 'unavailable' });

    assert.equal((await store.get('edelweiss-la-fouly-2026-08-07')).lastStatus, 'available');
    assert.equal((await store.get('auberge-mont-blanc-trient-2026-08-08')).lastStatus, 'unavailable');
});

test('builds next state from result and notification decision', () => {
    const state = nextStateForResult({
        available: true,
        checkedAt: '2026-06-19T05:49:00.000Z',
        bookingUrl: 'https://example.test/book',
        reason: 'Book button found.'
    }, true);

    assert.equal(state.lastStatus, 'available');
    assert.equal(state.lastCheckedAt, '2026-06-19T05:49:00.000Z');
    assert.equal(state.lastBookingUrl, 'https://example.test/book');
    assert.ok(state.lastNotifiedAt);
});

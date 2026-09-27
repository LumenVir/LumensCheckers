const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const { FAILURE_WINDOW_MS, LOCK_DURATION_MS, normalizeState, recordAttempt, verifyPin } = require('./vault-access');

(async () => {
  const start = 1_000_000;
  let result = recordAttempt(null, false, start);
  assert.equal(result.status, 'wrong');
  assert.equal(result.remaining, 2);
  result = recordAttempt(result.state, false, start + 1000);
  assert.equal(result.remaining, 1);
  result = recordAttempt(result.state, false, start + 2000);
  assert.equal(result.status, 'locked');
  assert.equal(result.state.lockedUntil, start + 2000 + LOCK_DURATION_MS);
  assert.equal(recordAttempt(result.state, true, start + 3000).status, 'locked');
  assert.equal(recordAttempt(result.state, true, result.state.lockedUntil).status, 'unlocked');

  result = recordAttempt(null, false, start);
  result = recordAttempt(result.state, false, start + FAILURE_WINDOW_MS);
  assert.equal(result.remaining, 2);
  assert.deepEqual(recordAttempt(result.state, true, start + FAILURE_WINDOW_MS + 1).state.failures, []);
  assert.deepEqual(normalizeState({ failures: ['bad', start + 1], lockedUntil: -1 }, start + 2).failures, [start + 1]);

  assert.equal(await verifyPin('995813', webcrypto), true);
  assert.equal(await verifyPin('995814', webcrypto), false);
  console.log('checkers vault access: all tests passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });

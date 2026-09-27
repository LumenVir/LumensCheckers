(function initVaultAccess(globalScope) {
  'use strict';

  const FAILURE_WINDOW_MS = 5 * 60 * 1000;
  const LOCK_DURATION_MS = 60 * 60 * 1000;
  const MAX_FAILURES = 3;
  const ITERATIONS = 210000;
  const SALT = 'b3d87a4bb2c5f2d281172df2363d5b2a';
  const PIN_HASH = '4180504511c588b9c1136d769f25c96c390843d6d544fd5a1a5d91994eb6fa11';

  function fromHex(hex) {
    return Uint8Array.from(hex.match(/../g), (part) => Number.parseInt(part, 16));
  }

  async function verifyPin(pin, cryptoApi = globalScope.crypto) {
    if (!cryptoApi?.subtle || typeof pin !== 'string') return false;
    const key = await cryptoApi.subtle.importKey(
      'raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits'],
    );
    const actual = new Uint8Array(await cryptoApi.subtle.deriveBits({
      name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(SALT), iterations: ITERATIONS,
    }, key, 256));
    const expected = fromHex(PIN_HASH);
    let difference = 0;
    for (let index = 0; index < expected.length; index += 1) difference |= actual[index] ^ expected[index];
    return difference === 0;
  }

  function normalizeState(value, now) {
    const lockedUntil = Number.isFinite(value?.lockedUntil) && value.lockedUntil > now
      ? value.lockedUntil : 0;
    const failures = Array.isArray(value?.failures) ? value.failures.filter((stamp) => (
      Number.isFinite(stamp) && stamp <= now && stamp > now - FAILURE_WINDOW_MS
    )).slice(-MAX_FAILURES + 1) : [];
    return { failures: lockedUntil ? [] : failures, lockedUntil };
  }

  function recordAttempt(value, correct, now) {
    const state = normalizeState(value, now);
    if (state.lockedUntil) return { status: 'locked', state };
    if (correct) return { status: 'unlocked', state: { failures: [], lockedUntil: 0 } };
    state.failures.push(now);
    if (state.failures.length >= MAX_FAILURES) {
      return {
        status: 'locked',
        state: { failures: [], lockedUntil: now + LOCK_DURATION_MS },
      };
    }
    return { status: 'wrong', remaining: MAX_FAILURES - state.failures.length, state };
  }

  const vaultAccess = { FAILURE_WINDOW_MS, LOCK_DURATION_MS, normalizeState, recordAttempt, verifyPin };
  globalScope.CheckersVaultAccess = vaultAccess;
  if (typeof module !== 'undefined' && module.exports) module.exports = vaultAccess;
}(typeof window !== 'undefined' ? window : globalThis));

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PICKER_TIMEOUT_MS,
  acceptSelection,
  armSession,
  cancelSession,
  getLiveSession,
  removeExpiredSessions
} from '../scripts/pickerSession.js';

const NOW = 1_000_000;

test('arms a picker session for one browser window', () => {
  const { sessions, session } = armSession({}, 4, 'token-a', NOW);

  assert.deepEqual(session, {
    token: 'token-a',
    windowId: 4,
    startedAt: NOW,
    expiresAt: NOW + PICKER_TIMEOUT_MS
  });
  assert.deepEqual(getLiveSession(sessions, 4, NOW), session);
  assert.equal(getLiveSession(sessions, 5, NOW), null);
});

test('keeps picker sessions independent between windows', () => {
  const first = armSession({}, 4, 'token-a', NOW);
  const second = armSession(first.sessions, 5, 'token-b', NOW + 10);

  assert.equal(getLiveSession(second.sessions, 4, NOW + 20)?.token, 'token-a');
  assert.equal(getLiveSession(second.sessions, 5, NOW + 20)?.token, 'token-b');
});

test('accepts only the first selection carrying the active token', () => {
  const armed = armSession({}, 4, 'token-a', NOW);
  const first = acceptSelection(armed.sessions, {
    windowId: 4,
    token: 'token-a'
  }, NOW + 1);
  const second = acceptSelection(first.sessions, {
    windowId: 4,
    token: 'token-a'
  }, NOW + 2);

  assert.equal(first.accepted, true);
  assert.equal(second.accepted, false);
  assert.equal(getLiveSession(first.sessions, 4, NOW + 2), null);
});

test('rejects a selection with a wrong or expired token', () => {
  const armed = armSession({}, 4, 'token-a', NOW);

  assert.equal(acceptSelection(armed.sessions, {
    windowId: 4,
    token: 'token-b'
  }, NOW + 1).accepted, false);
  assert.equal(acceptSelection(armed.sessions, {
    windowId: 4,
    token: 'token-a'
  }, NOW + PICKER_TIMEOUT_MS).accepted, false);
});

test('cancel and expiry cleanup affect only their own windows', () => {
  const first = armSession({}, 4, 'token-a', NOW);
  const second = armSession(first.sessions, 5, 'token-b', NOW + 500);
  const cancelled = cancelSession(second.sessions, 5);
  const expired = removeExpiredSessions(cancelled.sessions, NOW + PICKER_TIMEOUT_MS);

  assert.equal(cancelled.cancelled, true);
  assert.deepEqual(expired.expiredWindowIds, [4]);
  assert.deepEqual(expired.sessions, {});
});

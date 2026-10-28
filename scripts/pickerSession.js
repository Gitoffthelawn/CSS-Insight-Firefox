export const PICKER_TIMEOUT_MS = 120_000;

function isWindowId(value) {
  return Number.isInteger(value) && value >= 0;
}

function normalizeSession(value, fallbackWindowId = null) {
  const windowId = isWindowId(value?.windowId)
    ? value.windowId
    : fallbackWindowId;

  if (!isWindowId(windowId) ||
      typeof value?.token !== 'string' ||
      !value.token ||
      !Number.isFinite(value?.expiresAt)) {
    return null;
  }

  return {
    token: value.token,
    windowId,
    startedAt: Number(value.startedAt) || 0,
    expiresAt: Number(value.expiresAt)
  };
}

export function normalizeSessions(value) {
  const sessions = {};

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return sessions;
  }

  for (const [key, candidate] of Object.entries(value)) {
    const windowId = Number(key);
    const session = normalizeSession(candidate, windowId);

    if (session) sessions[String(session.windowId)] = session;
  }

  return sessions;
}

export function getLiveSession(value, windowId, now = Date.now()) {
  if (!isWindowId(windowId)) return null;

  const session = normalizeSessions(value)[String(windowId)] || null;
  return session && session.expiresAt > now ? session : null;
}

export function armSession(value, windowId, token, now = Date.now()) {
  if (!isWindowId(windowId)) {
    throw new TypeError('A valid window ID is required to arm the picker.');
  }

  if (typeof token !== 'string' || !token) {
    throw new TypeError('A picker token is required.');
  }

  const sessions = normalizeSessions(value);
  const session = {
    token,
    windowId,
    startedAt: now,
    expiresAt: now + PICKER_TIMEOUT_MS
  };

  sessions[String(windowId)] = session;
  return { sessions, session };
}

export function cancelSession(value, windowId) {
  const sessions = normalizeSessions(value);
  const key = String(windowId);
  const cancelled = Boolean(sessions[key]);

  delete sessions[key];
  return { sessions, cancelled };
}

export function acceptSelection(value, { windowId, token }, now = Date.now()) {
  const sessions = normalizeSessions(value);
  const session = getLiveSession(sessions, windowId, now);

  if (!session || session.token !== token) {
    return { sessions, accepted: false, session: null };
  }

  delete sessions[String(windowId)];
  return { sessions, accepted: true, session };
}

export function removeExpiredSessions(value, now = Date.now()) {
  const sessions = normalizeSessions(value);
  const expiredWindowIds = [];

  for (const [key, session] of Object.entries(sessions)) {
    if (session.expiresAt <= now) {
      expiredWindowIds.push(session.windowId);
      delete sessions[key];
    }
  }

  return { sessions, expiredWindowIds };
}

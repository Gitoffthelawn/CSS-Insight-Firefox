import {
  acceptSelection,
  armSession,
  cancelSession,
  getLiveSession,
  normalizeSessions,
  removeExpiredSessions
} from './pickerSession.js';

const TARGETS_KEY = 'cssInsightLastEligibleTabs';
const PICKER_SESSIONS_KEY = 'cssInsightPickerSessions';
const PICKER_RESULT_KEY = 'cssInsightPickerState';
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'file:']);
const API_TIMEOUT_MS = 2_500;
const TAB_MESSAGE_TIMEOUT_MS = 600;
const RESTRICTED_MOZILLA_HOSTS = new Set([
  'accounts-static.cdn.mozilla.net',
  'accounts.firefox.com',
  'addons.cdn.mozilla.net',
  'addons.mozilla.org',
  'api.accounts.firefox.com',
  'content.cdn.mozilla.net',
  'discovery.addons.mozilla.org',
  'install.mozilla.org',
  'oauth.accounts.firefox.com',
  'profile.accounts.firefox.com',
  'support.mozilla.org',
  'sync.services.mozilla.com'
]);

const ACTIONS = {
  getTrackedTarget: 'cssInsight:getTrackedTarget',
  rememberTarget: 'cssInsight:rememberTarget',
  armPicker: 'cssInsight:armPicker',
  cancelPicker: 'cssInsight:cancelPicker',
  getPickerStatus: 'cssInsight:getPickerStatus',
  pickerReady: 'cssInsight:pickerReady',
  selectElement: 'cssInsight:selectElement',
  startPicker: 'cssInsight:startPicker',
  stopPicker: 'cssInsight:stopPicker'
};

const trackedTabs = new Map();
let persistQueue = Promise.resolve();
let pickerQueue = Promise.resolve();

function withTimeout(promise, timeoutMs, operation) {
  let timer = 0;
  const timeout = new Promise((resolve, reject) => {
    timer = setTimeout(() => {
      const error = new Error(`${operation} timed out.`);
      error.name = 'TimeoutError';
      reject(error);
    }, timeoutMs);
  });

  return Promise.race([promise, timeout])
    .finally(() => clearTimeout(timer));
}

function storageGet(keys) {
  return withTimeout(
    browser.storage.local.get(keys),
    API_TIMEOUT_MS,
    'Reading picker storage'
  );
}

function storageSet(value) {
  return withTimeout(
    browser.storage.local.set(value),
    API_TIMEOUT_MS,
    'Writing picker storage'
  );
}

function queryTabs(queryInfo) {
  return withTimeout(
    browser.tabs.query(queryInfo),
    API_TIMEOUT_MS,
    'Querying browser tabs'
  );
}

function getTab(tabId) {
  return withTimeout(
    browser.tabs.get(tabId),
    API_TIMEOUT_MS,
    'Reading a browser tab'
  );
}

function sendTabMessage(tabId, message) {
  return withTimeout(
    browser.tabs.sendMessage(tabId, message),
    TAB_MESSAGE_TIMEOUT_MS,
    'Messaging a content tab'
  );
}

function executeScript(options) {
  return withTimeout(
    browser.scripting.executeScript(options),
    API_TIMEOUT_MS,
    'Injecting the picker controller'
  );
}

function isRestrictedMozillaPage(url) {
  return RESTRICTED_MOZILLA_HOSTS.has(url.hostname);
}

function isEligibleTab(tab) {
  if (!tab || !Number.isInteger(tab.id) || !Number.isInteger(tab.windowId)) {
    return false;
  }

  const rawUrl = tab.url || tab.pendingUrl || '';

  try {
    const url = new URL(rawUrl);
    return ALLOWED_PROTOCOLS.has(url.protocol) && !isRestrictedMozillaPage(url);
  } catch {
    return false;
  }
}

function normalizePickerResult(value) {
  return {
    selector: typeof value?.selector === 'string' ? value.selector : '',
    shadowPath: Array.isArray(value?.shadowPath)
      ? value.shadowPath
        .filter(selector => typeof selector === 'string' && selector.trim())
        .slice(0, 16)
        .map(selector => selector.trim().slice(0, 2048))
      : [],
    tabId: Number.isInteger(value?.tabId) ? value.tabId : null,
    frameId: Number.isInteger(value?.frameId) && value.frameId >= 0
      ? value.frameId
      : 0,
    documentId: typeof value?.documentId === 'string' && value.documentId
      ? value.documentId
      : null,
    windowId: Number.isInteger(value?.windowId) ? value.windowId : null,
    updatedAt: Number(value?.updatedAt) || 0
  };
}

function normalizePickerResults(value) {
  const results = {};

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return results;
  }

  const legacyResult = normalizePickerResult(value);

  if (legacyResult.selector && Number.isInteger(legacyResult.windowId)) {
    results[String(legacyResult.windowId)] = legacyResult;
    return results;
  }

  for (const [key, candidate] of Object.entries(value)) {
    const normalized = normalizePickerResult(candidate);
    const windowId = Number.isInteger(normalized.windowId)
      ? normalized.windowId
      : Number(key);

    if (normalized.selector && Number.isInteger(windowId)) {
      results[String(windowId)] = { ...normalized, windowId };
    }
  }

  return results;
}

function getWindowResult(value, windowId) {
  return normalizePickerResults(value)[String(windowId)] || normalizePickerResult(null);
}

function createToken() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function queuePickerTask(task) {
  const result = pickerQueue.then(task, task);
  pickerQueue = result.then(() => undefined, () => undefined);
  return result;
}

const loadedTargets = storageGet(TARGETS_KEY)
  .then(result => {
    const saved = result[TARGETS_KEY];

    if (!saved || typeof saved !== 'object') return;

    for (const [windowId, tabId] of Object.entries(saved)) {
      const numericWindowId = Number(windowId);

      if (Number.isInteger(numericWindowId) && Number.isInteger(tabId)) {
        trackedTabs.set(numericWindowId, tabId);
      }
    }
  })
  .catch(() => {
    // Tracking can recover from tab events if stored state is unavailable.
  });

function persistTargets() {
  persistQueue = persistQueue
    .catch(() => {})
    .then(() => storageSet({
      [TARGETS_KEY]: Object.fromEntries(trackedTabs)
    }));

  return persistQueue;
}

async function rememberTab(tab) {
  await loadedTargets;

  if (!isEligibleTab(tab)) return false;
  if (trackedTabs.get(tab.windowId) === tab.id) return true;

  trackedTabs.set(tab.windowId, tab.id);
  await persistTargets();
  return true;
}

async function forgetTab(tabId) {
  await loadedTargets;
  let changed = false;

  for (const [windowId, trackedTabId] of trackedTabs) {
    if (trackedTabId === tabId) {
      trackedTabs.delete(windowId);
      changed = true;
    }
  }

  if (changed) await persistTargets();
}

async function getTrackedTab(windowId) {
  await loadedTargets;

  const trackedTabId = trackedTabs.get(windowId);

  if (Number.isInteger(trackedTabId)) {
    try {
      const tab = await getTab(trackedTabId);

      if (tab?.windowId === windowId && isEligibleTab(tab)) {
        return tab;
      }
    } catch {
      // The fallback query below will repair the stored target.
    }

    trackedTabs.delete(windowId);
  }

  const tabs = await queryTabs({ windowId });
  const eligibleTabs = tabs.filter(isEligibleTab).sort((left, right) => {
    const rightAccessed = Number(right.lastAccessed) || 0;
    const leftAccessed = Number(left.lastAccessed) || 0;
    return rightAccessed - leftAccessed;
  });
  const fallback = eligibleTabs[0] || null;

  if (fallback) {
    await rememberTab(fallback);
  } else {
    await persistTargets();
  }

  return fallback;
}

async function sendPickerCommand(tab, action, session = null) {
  const message = {
    action,
    token: session?.token || null,
    expiresAt: session?.expiresAt || 0
  };

  try {
    return await sendTabMessage(tab.id, message);
  } catch (error) {
    if (action !== ACTIONS.startPicker || error.name === 'TimeoutError') {
      throw error;
    }

    try {
      await executeScript({
        target: { tabId: tab.id, allFrames: true },
        files: ['scripts/inspectionTarget.js', 'scripts/getTagName.js']
      });
    } catch {
      await executeScript({
        target: { tabId: tab.id },
        files: ['scripts/inspectionTarget.js', 'scripts/getTagName.js']
      });
    }
    return sendTabMessage(tab.id, message);
  }
}

async function broadcastPicker(windowId, action, session = null) {
  let tabs;

  try {
    tabs = await queryTabs({ windowId });
  } catch {
    return;
  }

  const tasks = tabs
    .filter(isEligibleTab)
    .map(tab => sendPickerCommand(tab, action, session).catch(() => null));

  await Promise.all(tasks);
}

async function readPickerData() {
  const stored = await storageGet([PICKER_SESSIONS_KEY, PICKER_RESULT_KEY]);
  return {
    sessions: normalizeSessions(stored[PICKER_SESSIONS_KEY]),
    results: normalizePickerResults(stored[PICKER_RESULT_KEY])
  };
}

async function cleanExpiredSessions(sessions) {
  const previousSessions = normalizeSessions(sessions);
  const cleaned = removeExpiredSessions(sessions);

  if (!cleaned.expiredWindowIds.length) return cleaned.sessions;

  await storageSet({ [PICKER_SESSIONS_KEY]: cleaned.sessions });

  await Promise.all(cleaned.expiredWindowIds.map(windowId =>
    broadcastPicker(
      windowId,
      ACTIONS.stopPicker,
      previousSessions[String(windowId)] || null
    )
  ));

  return cleaned.sessions;
}

function getPickerStatus(windowId) {
  return queuePickerTask(async () => {
    const data = await readPickerData();
    const sessions = await cleanExpiredSessions(data.sessions);

    return {
      ok: true,
      session: getLiveSession(sessions, windowId),
      result: getWindowResult(data.results, windowId)
    };
  });
}

function armPicker(windowId) {
  return queuePickerTask(async () => {
    if (!Number.isInteger(windowId)) {
      return { ok: false, error: 'A browser window is required.' };
    }

    const data = await readPickerData();
    const liveSessions = await cleanExpiredSessions(data.sessions);
    const armed = armSession(liveSessions, windowId, createToken());

    await storageSet({ [PICKER_SESSIONS_KEY]: armed.sessions });
    await broadcastPicker(windowId, ACTIONS.startPicker, armed.session);

    return {
      ok: true,
      session: armed.session,
      result: getWindowResult(data.results, windowId)
    };
  });
}

function cancelPicker(windowId) {
  return queuePickerTask(async () => {
    const data = await readPickerData();
    const liveSessions = await cleanExpiredSessions(data.sessions);
    const currentSession = liveSessions[String(windowId)] || null;
    const cancelled = cancelSession(liveSessions, windowId);

    if (cancelled.cancelled) {
      await storageSet({ [PICKER_SESSIONS_KEY]: cancelled.sessions });
      await broadcastPicker(windowId, ACTIONS.stopPicker, currentSession);
    }

    return {
      ok: true,
      session: null,
      result: getWindowResult(data.results, windowId)
    };
  });
}

function selectElement(tab, frameId, documentId, token, selector, shadowPath) {
  return queuePickerTask(async () => {
    if (!isEligibleTab(tab) || typeof selector !== 'string' || !selector) {
      return { ok: false, accepted: false };
    }

    const data = await readPickerData();
    const liveSessions = await cleanExpiredSessions(data.sessions);
    const selection = acceptSelection(liveSessions, {
      windowId: tab.windowId,
      token
    });

    if (!selection.accepted) {
      return {
        ok: true,
        accepted: false,
        result: getWindowResult(data.results, tab.windowId)
      };
    }

    const result = normalizePickerResult({
      selector: selector.slice(0, 4096),
      shadowPath,
      tabId: tab.id,
      frameId,
      documentId,
      windowId: tab.windowId,
      updatedAt: Date.now()
    });
    const results = {
      ...data.results,
      [String(tab.windowId)]: result
    };

    await storageSet({
      [PICKER_SESSIONS_KEY]: selection.sessions,
      [PICKER_RESULT_KEY]: results
    });
    await rememberTab(tab).catch(() => {});
    await broadcastPicker(tab.windowId, ACTIONS.stopPicker, selection.session);

    return { ok: true, accepted: true, result };
  });
}

async function armTabIfNeeded(tab) {
  if (!isEligibleTab(tab)) return;

  const status = await getPickerStatus(tab.windowId);

  if (status.session) {
    await sendPickerCommand(tab, ACTIONS.startPicker, status.session).catch(() => {});
  }
}

async function seedActiveTabs() {
  try {
    const tabs = await queryTabs({ active: true });

    for (const tab of tabs) {
      await rememberTab(tab);
      await armTabIfNeeded(tab);
    }
  } catch {
    // Normal tab activation events will seed tracking later.
  }
}

browser.tabs.onActivated.addListener(({ tabId }) => {
  getTab(tabId)
    .then(async tab => {
      await rememberTab(tab);
      await armTabIfNeeded(tab);
    })
    .catch(() => {});
});

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.active && (changeInfo.url || changeInfo.status === 'complete')) {
    rememberTab(tab).catch(() => {});
  }

  if (changeInfo.status === 'complete') {
    armTabIfNeeded(tab).catch(() => {});
  }
});

browser.tabs.onRemoved.addListener(tabId => {
  forgetTab(tabId).catch(() => {});
});

browser.runtime.onMessage.addListener((message, sender) => {
  if (message?.type === 'close_current_tab' && Number.isInteger(sender.tab?.id)) {
    return browser.tabs.remove(sender.tab.id);
  }

  if (message?.action === ACTIONS.rememberTarget) {
    return getTab(message.tabId).then(async tab => {
      const validWindow = !Number.isInteger(message.windowId) ||
        tab?.windowId === message.windowId;
      const remembered = validWindow ? await rememberTab(tab) : false;
      return { ok: remembered };
    }).catch(error => ({ ok: false, error: error.message }));
  }

  if (message?.action === ACTIONS.getTrackedTarget) {
    const windowId = Number.isInteger(message.windowId)
      ? message.windowId
      : sender.tab?.windowId;

    if (!Number.isInteger(windowId)) {
      return Promise.resolve({ ok: false, tab: null });
    }

    return getTrackedTab(windowId)
      .then(tab => ({ ok: true, tab }))
      .catch(error => ({ ok: false, tab: null, error: error.message }));
  }

  if (message?.action === ACTIONS.armPicker) {
    return armPicker(message.windowId)
      .catch(error => ({ ok: false, error: error.message }));
  }

  if (message?.action === ACTIONS.cancelPicker) {
    return cancelPicker(message.windowId)
      .catch(error => ({ ok: false, error: error.message }));
  }

  if (message?.action === ACTIONS.getPickerStatus) {
    return getPickerStatus(message.windowId)
      .catch(error => ({ ok: false, error: error.message }));
  }

  if (message?.action === ACTIONS.pickerReady) {
    const windowId = sender.tab?.windowId;

    if (!Number.isInteger(windowId)) {
      return Promise.resolve({ ok: false, session: null });
    }

    return getPickerStatus(windowId)
      .catch(error => ({ ok: false, session: null, error: error.message }));
  }

  if (message?.action === ACTIONS.selectElement) {
    if (!sender.tab) {
      return Promise.resolve({ ok: false, accepted: false });
    }

    return selectElement(
      sender.tab,
      sender.frameId,
      sender.documentId,
      message.token,
      message.selector,
      message.shadowPath
    ).catch(error => ({ ok: false, accepted: false, error: error.message }));
  }

  return false;
});

browser.runtime.onStartup.addListener(() => {
  seedActiveTabs();
});

function isFeatureUpdate(previousVersion, currentVersion) {
  const previousMatch = /^(\d+)\.(\d+)/.exec(String(previousVersion || ''));
  const currentMatch = /^(\d+)\.(\d+)/.exec(String(currentVersion || ''));

  return Boolean(previousMatch && currentMatch) &&
    (previousMatch[1] !== currentMatch[1] || previousMatch[2] !== currentMatch[2]);
}

browser.runtime.onInstalled.addListener(details => {
  seedActiveTabs();

  const version = browser.runtime.getManifest().version;

  if (details.reason === 'update' && isFeatureUpdate(details.previousVersion, version)) {
    browser.tabs.create({
      url: browser.runtime.getURL(`update/update.html?version=${version}`)
    });
  }
});

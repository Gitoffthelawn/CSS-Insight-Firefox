import {
  ensureContentScripts,
  executeScript,
  RUNTIME_CHANGED_ERROR_CODE
} from './scripts/common.js';
import {
  displayStyles,
  filterComputedStyles,
  isComputedStylesResult
} from './scripts/displayStyles.js';
import {
  getActiveTab,
  getCurrentWindowId,
  getTabById
} from './scripts/getActiveTab.js';
import { getPageAccess } from './scripts/getPageAccess.js';
import { t } from './scripts/t.js';

const COPY = t('copytext');
const COPIED = t('copied');
const NO_DATA = t('nodata');
const STOP = t('tracktagstop');
const START = t('tracktagstart');
const MORE_DETAILS = t('moredetails');
const LOOK_DETAILS = t('lookdetails');

const PICKER_RESULT_KEY = 'cssInsightPickerState';
const PICKER_SESSIONS_KEY = 'cssInsightPickerSessions';
const PICKER_MESSAGE_TIMEOUT_MS = 6_000;
const PICKER_ACTIONS = {
  arm: 'cssInsight:armPicker',
  cancel: 'cssInsight:cancelPicker',
  status: 'cssInsight:getPickerStatus'
};

const container = document.querySelector('.container');
const statusMessage = document.getElementById('statusMessage');
const trackTagBtn = document.getElementById('trackTagBtn');
const tagInput = document.getElementById('tagInput');
const targetContextValue = document.getElementById('targetContextValue');
const styleDataElement = document.getElementById('styleData');
const styleFilterControls = document.getElementById('styleFilterControls');
const styleFilterInput = document.getElementById('styleFilterInput');
const styleFilterStatus = document.getElementById('styleFilterStatus');
const pageActionElements = Array.from(document.querySelectorAll('[data-page-action]'));

let isBusy = false;
let currentWindowId = null;
let targetTab = null;
let targetFrameId = 0;
let targetDocumentId = null;
let targetShadowPath = [];
let targetRefreshId = 0;
let refreshTimer = 0;
let pickerExpiryTimer = 0;
let pickerSession = null;
let computedStylesResult = null;
let resultTargetPromise = Promise.resolve();
let pickerResult = {
  selector: '',
  tabId: null,
  windowId: null,
  updatedAt: 0
};

class PageAccessError extends Error {
  constructor(messageKey) {
    super(messageKey);
    this.name = 'PageAccessError';
    this.messageKey = messageKey;
  }
}

function storageGet(area, keys) {
  return browser.storage[area].get(keys);
}

function storageSet(area, value) {
  return browser.storage[area].set(value);
}

function storageRemove(area, keys) {
  return browser.storage[area].remove(keys);
}

function sendRuntimeMessage(message) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      reject(new Error(t('pickertimeout')));
    }, PICKER_MESSAGE_TIMEOUT_MS);

    browser.runtime.sendMessage(message)
      .then(response => {
        if (settled) return;

        settled = true;
        clearTimeout(timer);
        resolve(response);
      })
      .catch(error => {
        if (settled) return;

        settled = true;
        clearTimeout(timer);
        reject(error);
      });
  });
}

function normalizePickerResult(value) {
  return {
    selector: typeof value?.selector === 'string' ? value.selector : '',
    shadowPath: Array.isArray(value?.shadowPath)
      ? value.shadowPath.filter(selector => typeof selector === 'string' && selector.trim())
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

function getWindowResult(value) {
  if (!Number.isInteger(currentWindowId)) return normalizePickerResult(null);
  return normalizePickerResults(value)[String(currentWindowId)] || normalizePickerResult(null);
}

function normalizePickerSession(value) {
  if (typeof value?.token !== 'string' ||
      !value.token ||
      !Number.isInteger(value?.windowId) ||
      !Number.isFinite(value?.expiresAt) ||
      value.expiresAt <= Date.now()) {
    return null;
  }

  return {
    token: value.token,
    windowId: value.windowId,
    startedAt: Number(value.startedAt) || 0,
    expiresAt: Number(value.expiresAt)
  };
}

function getWindowSession(value) {
  if (!Number.isInteger(currentWindowId) || !value || typeof value !== 'object') {
    return null;
  }

  return normalizePickerSession(value[String(currentWindowId)]);
}

async function loadPickerResult() {
  const localResult = await storageGet('local', PICKER_RESULT_KEY);
  const storedValue = localResult[PICKER_RESULT_KEY];

  if (storedValue) {
    const normalized = getWindowResult(storedValue);
    const legacy = normalizePickerResult(storedValue);

    if (legacy.selector &&
        (!Number.isInteger(legacy.windowId) || legacy.windowId === currentWindowId)) {
      const migrated = { ...legacy, windowId: currentWindowId };
      await storageSet('local', {
        [PICKER_RESULT_KEY]: { [String(currentWindowId)]: migrated }
      });
      return migrated;
    }

    if (normalized.selector) return normalized;
  }

  try {
    const legacy = await storageGet('sync', ['tagInfo', 'isTracking']);

    if (typeof legacy.tagInfo === 'string' && legacy.tagInfo) {
      const migratedResult = normalizePickerResult({
        selector: legacy.tagInfo.replace(/ +/g, '.'),
        windowId: currentWindowId,
        updatedAt: Date.now()
      });

      await storageSet('local', {
        [PICKER_RESULT_KEY]: { [String(currentWindowId)]: migratedResult }
      });
      await storageRemove('sync', ['tagInfo', 'isTracking']);
      return migratedResult;
    }
  } catch {
    // Legacy synchronized state is optional and must not block the popup.
  }

  return normalizePickerResult(null);
}

function showStatus(message, type = 'info') {
  statusMessage.textContent = message;
  statusMessage.className = `status ${type}`;
}

function clearStatus() {
  statusMessage.textContent = '';
  statusMessage.className = 'status hidden';
}

function refreshDisabledState() {
  for (const element of pageActionElements) {
    element.disabled = isBusy;
  }

  tagInput.disabled = isBusy;
  container.setAttribute('aria-busy', String(isBusy));
}

function setBusy(value) {
  isBusy = value;
  refreshDisabledState();
}

function getTargetPageLabel(tab) {
  const rawUrl = tab?.url || tab?.pendingUrl || '';

  try {
    const url = new URL(rawUrl);
    return url.hostname || url.protocol.replace(':', '');
  } catch {
    return rawUrl || t('targetunavailable');
  }
}

function updateTargetContextUi() {
  if (!targetTab) {
    targetContextValue.textContent = t('targetunavailable');
    return;
  }

  const contextParts = [getTargetPageLabel(targetTab)];

  if (targetFrameId > 0) {
    contextParts.push(`${t('iframecontext')} ${targetFrameId}`);
  }

  if (targetShadowPath.length) {
    contextParts.push(targetShadowPath.join(' >>> '));
  }

  targetContextValue.textContent = contextParts.join(' › ');
}

function updatePickerUi() {
  clearTimeout(pickerExpiryTimer);
  pickerExpiryTimer = 0;
  const pickerLabel = pickerSession ? STOP : START;

  if (trackTagBtn.textContent !== pickerLabel) {
    trackTagBtn.textContent = pickerLabel;
  }

  if (pickerResult.selector && tagInput.value !== pickerResult.selector) {
    tagInput.value = pickerResult.selector;
  }

  if (pickerSession) {
    const delay = Math.max(0, pickerSession.expiresAt - Date.now()) + 25;

    pickerExpiryTimer = setTimeout(async () => {
      try {
        await refreshPickerStatus();

        if (!pickerSession) {
          showStatus(t('pickerexpired'));
        }
      } catch {
        pickerSession = null;
        updatePickerUi();
      }
    }, delay);
  }
}

async function adoptResultTarget() {
  if (!Number.isInteger(pickerResult.tabId)) return;

  try {
    const tab = await getTabById(pickerResult.tabId);

    if (getPageAccess(tab).allowed) {
      targetTab = tab;
      targetFrameId = pickerResult.frameId;
      targetDocumentId = pickerResult.documentId;
      targetShadowPath = [...pickerResult.shadowPath];
    }
  } catch {
    // A closed result tab falls back to the most recent eligible page.
  } finally {
    updateTargetContextUi();
  }
}

async function clearWindowPickerResult() {
  const localResult = await storageGet('local', PICKER_RESULT_KEY);
  const results = normalizePickerResults(localResult[PICKER_RESULT_KEY]);
  delete results[String(currentWindowId)];

  if (Object.keys(results).length) {
    await storageSet('local', { [PICKER_RESULT_KEY]: results });
  } else {
    await storageRemove('local', PICKER_RESULT_KEY);
  }

  pickerResult = normalizePickerResult(null);
}

function formatOperationError(error, tab) {
  if (error instanceof PageAccessError) {
    return t(error.messageKey);
  }

  if (error?.code === RUNTIME_CHANGED_ERROR_CODE) {
    return t('runtimechanged');
  }

  const pageAccess = getPageAccess(tab);

  if (tab && !pageAccess.allowed) {
    return t(pageAccess.messageKey);
  }

  const message = error instanceof Error ? error.message : String(error || '');
  const lowerMessage = message.toLowerCase();
  const pageUrl = tab?.url || error?.pageUrl || '';

  if (pageUrl.startsWith('file:') &&
      /(access|host permission|not allowed|denied)/.test(lowerMessage)) {
    return t('pageaccessfile');
  }

  if (lowerMessage.includes('cannot access a chrome') ||
      lowerMessage.includes('cannot access contents of url') ||
      lowerMessage.includes('missing host permission') ||
      lowerMessage.includes('not allowed to access privileged pages') ||
      lowerMessage.includes('may not access this page')) {
    return t('pageaccessprotected');
  }

  return message ? `${t('operationfailed')} ${message}` : t('operationfailed');
}

function assertPageAccess(tab) {
  const access = getPageAccess(tab);

  if (!access.allowed) {
    throw new PageAccessError(access.messageKey);
  }
}

async function refreshTarget() {
  const refreshId = ++targetRefreshId;

  try {
    const resolvedTab = await getActiveTab();

    if (refreshId === targetRefreshId) {
      targetTab = resolvedTab;
      targetFrameId = 0;
      targetDocumentId = null;
      targetShadowPath = [];
      updateTargetContextUi();
    }
  } catch {
    // Page operations will report a precise error if no target remains.
  }

  return targetTab;
}

async function refreshPickerStatus() {
  if (!Number.isInteger(currentWindowId)) return;

  const response = await sendRuntimeMessage({
    action: PICKER_ACTIONS.status,
    windowId: currentWindowId
  });

  if (!response?.ok) {
    throw new Error(response?.error || 'The element picker status is unavailable.');
  }

  pickerSession = normalizePickerSession(response.session);
  pickerResult = normalizePickerResult(response.result || pickerResult);
  updatePickerUi();
  await adoptResultTarget();
}

async function refreshPopupContext() {
  currentWindowId = await getCurrentWindowId();
  await refreshTarget();
  await refreshPickerStatus();
}

function scheduleContextRefresh() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refreshPopupContext().catch(() => {});
  }, 50);
}

async function getLiveTargetTab() {
  await resultTargetPromise;

  if (Number.isInteger(targetTab?.id)) {
    try {
      targetTab = await getTabById(targetTab.id);
      return targetTab;
    } catch {
      targetTab = null;
      targetFrameId = 0;
      targetDocumentId = null;
      targetShadowPath = [];
      updateTargetContextUi();
    }
  }

  return refreshTarget();
}

async function prepareTargetContext() {
  const tab = await getLiveTargetTab();
  assertPageAccess(tab);

  try {
    const controllers = await ensureContentScripts(
      tab.id,
      targetFrameId,
      targetDocumentId
    );
    return {
      tab,
      frameId: targetFrameId,
      documentId: targetDocumentId,
      runtimeInstanceId: controllers.runtimeInstanceId,
      shadowPath: [...targetShadowPath]
    };
  } catch (error) {
    const normalizedError = error instanceof Error ? error : new Error(String(error));
    normalizedError.pageUrl = tab.url || '';
    throw normalizedError;
  }
}

async function prepareTopFrameRuntime(context) {
  if (context.frameId === 0) {
    return {
      documentId: context.documentId,
      runtimeInstanceId: context.runtimeInstanceId
    };
  }

  const controllers = await ensureContentScripts(context.tab.id, 0, null);
  return {
    documentId: null,
    runtimeInstanceId: controllers.runtimeInstanceId
  };
}

async function runPageOperation(operation) {
  if (isBusy) return null;

  setBusy(true);
  clearStatus();
  let tab = null;

  try {
    const context = await prepareTargetContext();
    tab = context.tab;
    return await operation(context);
  } catch (error) {
    showStatus(formatOperationError(error, tab || targetTab), 'error');
    return null;
  } finally {
    setBusy(false);
  }
}

function getSelector() {
  return tagInput.value.trim() || 'body';
}

function applyComputedStylesFilter() {
  if (!computedStylesResult) return;

  const query = styleFilterInput.value.trim();
  const filtered = filterComputedStyles(
    computedStylesResult,
    query,
    t('nofiltermatches')
  );
  displayStyles(filtered.text);
  styleFilterStatus.textContent = query
    ? filtered.matchCount
      ? t('filtermatchcount', String(filtered.matchCount))
      : t('nofiltermatches')
    : '';
}

function displayStyleResult(result) {
  computedStylesResult = isComputedStylesResult(result) ? result : null;
  styleFilterInput.value = '';
  styleFilterStatus.textContent = '';
  styleFilterControls.classList.toggle('hidden', !computedStylesResult);

  if (computedStylesResult) {
    applyComputedStylesFilter();
  } else {
    displayStyles(result);
  }
}

async function retrieveStyles(scriptFile, data = null) {
  await runPageOperation(async context => {
    const request = data && typeof data === 'object'
      ? { ...data, shadowPath: context.shadowPath }
      : { selector: data, shadowPath: context.shadowPath };
    const result = await executeScript(
      context.tab.id,
      scriptFile,
      request,
      context.frameId,
      context.documentId,
      context.runtimeInstanceId
    );
    displayStyleResult(result);
  });
}

document.getElementById('declaredStylesBtn').addEventListener('click', () => {
  retrieveStyles('scripts/getDeclaredStyles.js', getSelector());
});

document.getElementById('computedStylesBtn').addEventListener('click', () => {
  retrieveStyles('scripts/getComputedStyles.js', {
    selector: getSelector(),
    structured: true
  });
});

styleFilterInput.addEventListener('input', applyComputedStylesFilter);
styleFilterInput.addEventListener('keydown', event => {
  if (event.key === 'Escape' && styleFilterInput.value) {
    event.preventDefault();
    styleFilterInput.value = '';
    applyComputedStylesFilter();
  }
});

document.getElementById('mediaRulesBtn').addEventListener('click', () => {
  retrieveStyles('scripts/getMediaRules.js', {});
});

document.getElementById('keyframesRulesBtn').addEventListener('click', () => {
  retrieveStyles('scripts/getKeyframesRules.js', {});
});

document.getElementById('copyBtn').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(styleDataElement.textContent);
    const button = document.getElementById('copyBtn');
    button.textContent = COPIED;
    setTimeout(() => { button.textContent = COPY; }, 3000);
  } catch (error) {
    showStatus(formatOperationError(error), 'error');
  }
});

document.getElementById('moreDetailsBtn').addEventListener('click', async () => {
  const cssData = styleDataElement.textContent || NO_DATA;

  await runPageOperation(async context => {
    const topFrameRuntime = await prepareTopFrameRuntime(context);
    await executeScript(
      context.tab.id,
      'scripts/showModalWithCSSData.js',
      cssData,
      0,
      topFrameRuntime.documentId,
      topFrameRuntime.runtimeInstanceId
    );
    const button = document.getElementById('moreDetailsBtn');
    button.textContent = LOOK_DETAILS;
    setTimeout(() => { button.textContent = MORE_DETAILS; }, 3000);
  });
});

document.getElementById('saveBtn').addEventListener('click', () => {
  const blob = new Blob([styleDataElement.textContent], { type: 'text/css' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = 'styles.css';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
});

document.getElementById('applyRuleBtn').addEventListener('click', () => {
  const panel = document.getElementById('newRule');
  panel.classList.remove('hidden');
  document.getElementById('newRuleData').focus();
});

document.getElementById('injectCSSBtn').addEventListener('click', async () => {
  const rule = document.getElementById('newRuleData').value.trim();

  if (!rule) {
    showStatus(t('emptyrule'), 'error');
    return;
  }

  await runPageOperation(async context => {
    await executeScript(
      context.tab.id,
      'scripts/applyStyles.js',
      { cssText: rule, shadowPath: context.shadowPath },
      context.frameId,
      context.documentId,
      context.runtimeInstanceId
    );
    document.getElementById('newRule').classList.add('hidden');
    showStatus(t('stylesapplied'), 'success');
  });
});

document.getElementById('removeRuleBtn').addEventListener('click', async () => {
  await runPageOperation(async context => {
    const removed = await executeScript(
      context.tab.id,
      'scripts/applyStyles.js',
      { remove: true, shadowPath: context.shadowPath },
      context.frameId,
      context.documentId,
      context.runtimeInstanceId
    );
    showStatus(t(removed ? 'stylesremoved' : 'nostylespreview'), removed ? 'success' : 'info');
  });
});

document.getElementById('useActivePageBtn').addEventListener('click', async () => {
  if (isBusy) return;

  setBusy(true);
  clearStatus();

  try {
    await clearWindowPickerResult();
    await refreshTarget();
    assertPageAccess(targetTab);
    showStatus(t('activepageselected'), 'success');
  } catch (error) {
    showStatus(formatOperationError(error, targetTab), 'error');
  } finally {
    setBusy(false);
  }
});

document.getElementById('hideCssInfo').addEventListener('click', () => {
  document.getElementById('cssInfo').classList.add('hidden');
});

document.getElementById('hideNewRule').addEventListener('click', () => {
  document.getElementById('newRule').classList.add('hidden');
});

trackTagBtn.addEventListener('click', async () => {
  if (isBusy) return;

  setBusy(true);

  try {
    if (!Number.isInteger(currentWindowId)) {
      currentWindowId = await getCurrentWindowId();
    }

    await refreshPickerStatus();
    const action = pickerSession ? PICKER_ACTIONS.cancel : PICKER_ACTIONS.arm;
    const response = await sendRuntimeMessage({
      action,
      windowId: currentWindowId
    });

    if (!response?.ok) {
      throw new Error(response?.error || 'The element picker could not change state.');
    }

    pickerSession = normalizePickerSession(response.session);
    pickerResult = normalizePickerResult(response.result || pickerResult);
    updatePickerUi();

    if (action === PICKER_ACTIONS.arm) {
      showStatus(t('pickinstruction'));
    } else {
      clearStatus();
    }
  } catch (error) {
    showStatus(formatOperationError(error), 'error');
  } finally {
    setBusy(false);
  }
});

browser.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return;

  const sessionChange = changes[PICKER_SESSIONS_KEY];
  const resultChange = changes[PICKER_RESULT_KEY];

  if (!sessionChange && !resultChange) return;

  let selected = false;

  if (sessionChange) {
    pickerSession = getWindowSession(sessionChange.newValue);
  }

  if (resultChange) {
    const nextResult = getWindowResult(resultChange.newValue);
    selected = nextResult.updatedAt > pickerResult.updatedAt && Boolean(nextResult.selector);
    pickerResult = nextResult;

    if (selected) {
      resultTargetPromise = adoptResultTarget();
    }
  }

  updatePickerUi();

  if (selected) {
    showStatus(`${t('selectedtooltip')}: ${pickerResult.selector}`, 'success');
  }
});

window.addEventListener('focus', scheduleContextRefresh);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    scheduleContextRefresh();
  }
});

async function initialize() {
  setBusy(true);

  try {
    currentWindowId = await getCurrentWindowId();
    pickerResult = await loadPickerResult();
    updatePickerUi();
    updateTargetContextUi();
    await refreshPopupContext();
  } catch (error) {
    showStatus(formatOperationError(error), 'error');
  } finally {
    setBusy(false);
  }
}

initialize();

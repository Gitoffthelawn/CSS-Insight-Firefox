const SUPPORT_SCRIPT_FILES = [
  'scripts/formatRule.js',
  'scripts/inspectionTarget.js',
  'scripts/cssRuleWalker.js',
  'scripts/getDeclaredStyles.js',
  'scripts/getComputedStyles.js',
  'scripts/getMediaRules.js',
  'scripts/getKeyframesRules.js',
  'scripts/applyStyles.js',
  'scripts/showModalWithCSSData.js',
  'scripts/inspectionBridge.js',
  'scripts/getTagName.js'
];

const SCRIPT_OPERATIONS = Object.freeze({
  'scripts/getDeclaredStyles.js': 'getDeclaredStyles',
  'scripts/getComputedStyles.js': 'getComputedStyles',
  'scripts/getMediaRules.js': 'getMediaRules',
  'scripts/getKeyframesRules.js': 'getKeyframes',
  'scripts/applyStyles.js': 'applyStyles',
  'scripts/showModalWithCSSData.js': 'showModalWithCSSData'
});

const GET_PICKER_STATE = 'cssInsight:getPickerState';
const GET_INSPECTION_STATE = 'cssInsight:getInspectionRuntimeState';
const RUN_PAGE_OPERATION = 'cssInsight:runPageOperation';
export const RUNTIME_CHANGED_ERROR_CODE = 'CSS_INSIGHT_RUNTIME_CHANGED';

function createRuntimeChangedError() {
  const error = new Error('The page changed before the operation completed.');
  error.name = 'PageRuntimeChangedError';
  error.code = RUNTIME_CHANGED_ERROR_CODE;
  return error;
}

function getInjectionTarget(tabId, frameId, documentId) {
  return typeof documentId === 'string' && documentId
    ? { tabId, documentIds: [documentId] }
    : { tabId, frameIds: [frameId] };
}

export function sendTabMessage(tabId, message, frameId = 0, documentId = null) {
  if (typeof documentId === 'string' && documentId) {
    return browser.tabs.sendMessage(tabId, message, { documentId })
      .catch(() => browser.tabs.sendMessage(tabId, message, { frameId }));
  }

  return browser.tabs.sendMessage(tabId, message, { frameId });
}

function isPickerResponse(response) {
  return response?.source === 'css-insight-picker' && response.ok === true;
}

function isInspectionResponse(response) {
  return response?.source === 'css-insight-inspection' && response.ok === true;
}

function isInspectionStateResponse(response) {
  return isInspectionResponse(response) &&
    typeof response.state?.instanceId === 'string' &&
    Boolean(response.state.instanceId);
}

function attachRuntimeInstance(state) {
  return {
    ...state,
    runtimeInstanceId: state.inspection.state.instanceId
  };
}

async function getControllerState(tabId, frameId, documentId) {
  const [picker, inspection] = await Promise.all([
    sendTabMessage(tabId, { action: GET_PICKER_STATE }, frameId, documentId),
    sendTabMessage(tabId, { action: GET_INSPECTION_STATE }, frameId, documentId)
  ]);

  return { picker, inspection };
}

export async function ensureContentScripts(tabId, frameId = 0, documentId = null) {
  try {
    const state = await getControllerState(tabId, frameId, documentId);

    if (isPickerResponse(state.picker) && isInspectionStateResponse(state.inspection)) {
      return attachRuntimeInstance(state);
    }
  } catch {
    // One or both content controllers are not available in this document yet.
  }

  await browser.scripting.executeScript({
    target: getInjectionTarget(tabId, frameId, documentId),
    files: SUPPORT_SCRIPT_FILES
  });

  const state = await getControllerState(tabId, frameId, documentId);

  if (!isPickerResponse(state.picker) || !isInspectionStateResponse(state.inspection)) {
    throw new Error('The CSS Insight page controllers did not respond.');
  }

  return attachRuntimeInstance(state);
}

export async function executeScript(
  tabId,
  scriptFile,
  data = null,
  frameId = 0,
  documentId = null,
  runtimeInstanceId = null
) {
  const operation = SCRIPT_OPERATIONS[scriptFile];

  if (!operation) {
    throw new Error(`Unknown CSS Insight script: ${scriptFile}`);
  }

  if (typeof runtimeInstanceId !== 'string' || !runtimeInstanceId) {
    throw createRuntimeChangedError();
  }

  const response = await sendTabMessage(
    tabId,
    { action: RUN_PAGE_OPERATION, operation, data, instanceId: runtimeInstanceId },
    frameId,
    documentId
  );

  if (response?.source === 'css-insight-inspection' &&
      response.errorCode === 'runtime_changed') {
    throw createRuntimeChangedError();
  }

  if (!isInspectionResponse(response)) {
    throw new Error(response?.error || 'The CSS Insight page operation did not respond.');
  }

  return response.result;
}

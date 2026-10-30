(() => {
  const CONTROLLER_KEY = '__CSS_INSIGHT_INSPECTION_BRIDGE__';
  const SOURCE = 'css-insight-inspection';
  const VERSION = '1.24.0';
  const ACTIONS = {
    getState: 'cssInsight:getInspectionRuntimeState',
    run: 'cssInsight:runPageOperation'
  };
  const existingController = globalThis[CONTROLLER_KEY];

  if (existingController?.version === VERSION) return;

  existingController?.destroy?.();

  function createInstanceId() {
    try {
      const value = globalThis.crypto?.randomUUID?.();

      if (typeof value === 'string' && value) return value;
    } catch {
      // A non-secure document may not expose randomUUID in an older browser.
    }

    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  const instanceId = createInstanceId();

  function getOperations() {
    return globalThis.__CSS_INSIGHT_OPERATIONS__ || {};
  }

  function getState() {
    return {
      version: VERSION,
      instanceId,
      operations: Object.keys(getOperations()).sort()
    };
  }

  function onMessage(request, sender, sendResponse) {
    if (request?.action === ACTIONS.getState) {
      sendResponse({ source: SOURCE, ok: true, state: getState() });
      return false;
    }

    if (request?.action !== ACTIONS.run) return false;

    if (request.instanceId !== instanceId) {
      sendResponse({
        source: SOURCE,
        ok: false,
        errorCode: 'runtime_changed'
      });
      return false;
    }

    const operation = getOperations()[request.operation];

    if (typeof operation !== 'function') {
      sendResponse({
        source: SOURCE,
        ok: false,
        error: `Unknown CSS Insight operation: ${String(request.operation || '')}`
      });
      return false;
    }

    Promise.resolve()
      .then(() => operation(request.data))
      .then(result => {
        sendResponse({ source: SOURCE, ok: true, result });
      })
      .catch(error => {
        sendResponse({
          source: SOURCE,
          ok: false,
          error: error?.message || String(error || 'The page operation failed.')
        });
      });

    return true;
  }

  function destroy() {
    browser.runtime.onMessage.removeListener(onMessage);
    window.removeEventListener('pagehide', destroy);
    delete globalThis[CONTROLLER_KEY];
  }

  globalThis[CONTROLLER_KEY] = { version: VERSION, destroy, getState };
  browser.runtime.onMessage.addListener(onMessage);
  window.addEventListener('pagehide', destroy, { once: true });
})();

(() => {
  const CONTROLLER_KEY = '__CSS_INSIGHT_PICKER__';
  const SOURCE = 'css-insight-picker';
  const RETIRED_TOKEN_LIMIT = 16;
  const ACTIONS = {
    getState: 'cssInsight:getPickerState',
    pickerReady: 'cssInsight:pickerReady',
    selectElement: 'cssInsight:selectElement',
    start: 'cssInsight:startPicker',
    stop: 'cssInsight:stopPicker'
  };

  const existingController = globalThis[CONTROLLER_KEY];

  if (existingController?.version === '1.21.1') {
    return;
  }

  existingController?.destroy?.();

  let isTracking = false;
  let activeToken = null;
  let expiresAt = 0;
  let tooltipHost = null;
  let tooltipLabel = null;
  let cursorStyle = null;
  let animationFrame = 0;
  let latestPointer = null;
  let expiryTimer = 0;
  let tooltipRemovalTimer = 0;
  const retiredTokens = [];

  const escapeIdentifier = globalThis.CSS?.escape || (value =>
    String(value).replace(/[^a-zA-Z0-9_-]/g, character => `\\${character}`));

  function sendRuntimeMessage(message) {
    return browser.runtime.sendMessage(message);
  }

  function getState() {
    return {
      isTracking,
      token: activeToken,
      expiresAt
    };
  }

  function queryCount(selector) {
    try {
      return document.querySelectorAll(selector).length;
    } catch {
      return 0;
    }
  }

  function normalizeElement(element) {
    let current = element;
    let root = current?.getRootNode?.();

    while (globalThis.ShadowRoot && root instanceof ShadowRoot) {
      current = root.host;
      root = current?.getRootNode?.();
    }

    return current;
  }

  function getEventElement(event) {
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    const element = path.find(node =>
      node?.nodeType === Node.ELEMENT_NODE && node !== tooltipHost
    ) || event.target;

    return normalizeElement(element);
  }

  function createSegment(element) {
    const tagName = element.localName || element.tagName.toLowerCase();

    if (element.id) {
      const idSelector = `#${escapeIdentifier(element.id)}`;

      if (queryCount(idSelector) === 1) {
        return `${tagName}${idSelector}`;
      }
    }

    const classes = Array.from(element.classList || [])
      .filter(Boolean)
      .slice(0, 4)
      .map(className => `.${escapeIdentifier(className)}`)
      .join('');

    let segment = `${tagName}${classes}`;
    const parent = element.parentElement;

    if (parent) {
      const siblings = Array.from(parent.children)
        .filter(sibling => sibling.localName === element.localName);

      if (siblings.length > 1) {
        segment += `:nth-of-type(${siblings.indexOf(element) + 1})`;
      }
    }

    return segment;
  }

  function createUniqueSelector(element) {
    const segments = [];
    let current = normalizeElement(element);

    while (current?.nodeType === Node.ELEMENT_NODE) {
      segments.unshift(createSegment(current));
      const selector = segments.join(' > ');

      if (queryCount(selector) === 1) {
        return selector;
      }

      if (current === document.documentElement) {
        break;
      }

      current = current.parentElement;
    }

    return segments.join(' > ') || 'body';
  }

  function createTooltip() {
    if (tooltipHost?.isConnected) return;

    tooltipHost = document.createElement('div');
    tooltipHost.style.setProperty('all', 'initial', 'important');
    tooltipHost.style.setProperty('position', 'fixed', 'important');
    tooltipHost.style.setProperty('display', 'none', 'important');
    tooltipHost.style.setProperty('max-width', 'calc(100vw - 24px)', 'important');
    tooltipHost.style.setProperty('pointer-events', 'none', 'important');
    tooltipHost.style.setProperty('z-index', '2147483647', 'important');

    const shadow = tooltipHost.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = `
      :host { color-scheme: light; }
      span {
        display: block;
        box-sizing: border-box;
        max-width: calc(100vw - 24px);
        padding: 7px 10px;
        overflow: hidden;
        border: 1px solid #17324d;
        border-radius: 6px;
        background: rgba(255, 255, 255, 0.96);
        box-shadow: 0 5px 18px rgba(0, 0, 0, 0.25);
        color: #102a43;
        font: 600 13px/1.35 system-ui, sans-serif;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    `;
    tooltipLabel = document.createElement('span');
    shadow.append(style, tooltipLabel);
    (document.documentElement || document.body).appendChild(tooltipHost);
  }

  function showTooltip(message, clientX = 12, clientY = 12) {
    createTooltip();
    tooltipLabel.textContent = message;
    tooltipHost.style.setProperty('display', 'block', 'important');

    const bounds = tooltipHost.getBoundingClientRect();
    const left = Math.max(8, Math.min(clientX + 12, window.innerWidth - bounds.width - 8));
    const top = Math.max(8, Math.min(clientY + 12, window.innerHeight - bounds.height - 8));

    tooltipHost.style.setProperty('left', `${left}px`, 'important');
    tooltipHost.style.setProperty('top', `${top}px`, 'important');
  }

  function removeTooltip() {
    clearTimeout(tooltipRemovalTimer);
    tooltipRemovalTimer = 0;
    tooltipHost?.remove();
    tooltipHost = null;
    tooltipLabel = null;
  }

  function installCursor() {
    cursorStyle?.remove();
    cursorStyle = document.createElement('style');
    cursorStyle.dataset.cssInsightPicker = 'cursor';
    cursorStyle.textContent = 'html, html * { cursor: crosshair !important; }';
    (document.head || document.documentElement).appendChild(cursorStyle);
  }

  function removeCursor() {
    cursorStyle?.remove();
    cursorStyle = null;
  }

  function updateTooltipFromPointer() {
    animationFrame = 0;

    if (!isTracking || !latestPointer) return;

    const element = getEventElement(latestPointer);

    if (!element) return;

    showTooltip(
      createUniqueSelector(element),
      latestPointer.clientX,
      latestPointer.clientY
    );
  }

  function onPointerMove(event) {
    latestPointer = event;

    if (!animationFrame) {
      animationFrame = requestAnimationFrame(updateTooltipFromPointer);
    }
  }

  function removeTrackingListeners() {
    document.removeEventListener('pointermove', onPointerMove, true);
    document.removeEventListener('click', onElementClick, true);

    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    }

    latestPointer = null;
  }

  function retireToken(token) {
    if (typeof token !== 'string' || !token || retiredTokens.includes(token)) return;

    retiredTokens.push(token);

    if (retiredTokens.length > RETIRED_TOKEN_LIMIT) {
      retiredTokens.shift();
    }
  }

  function stopTracking({ keepTooltip = false, token = null } = {}) {
    if (token) retireToken(token);

    if (token && activeToken && token !== activeToken) {
      return getState();
    }

    retireToken(activeToken);
    isTracking = false;
    activeToken = null;
    expiresAt = 0;
    clearTimeout(expiryTimer);
    expiryTimer = 0;
    removeTrackingListeners();
    removeCursor();

    if (!keepTooltip) removeTooltip();
    return getState();
  }

  function scheduleExpiry() {
    clearTimeout(expiryTimer);
    const delay = Math.max(0, expiresAt - Date.now());

    expiryTimer = setTimeout(() => {
      stopTracking();
    }, delay);
  }

  function startTracking(token, expiry) {
    if (typeof token !== 'string' || !token || !Number.isFinite(expiry) || expiry <= Date.now()) {
      return stopTracking({ token: typeof token === 'string' ? token : null });
    }

    if (retiredTokens.includes(token)) {
      return getState();
    }

    if (isTracking && activeToken === token) {
      expiresAt = expiry;
      scheduleExpiry();
      return getState();
    }

    stopTracking();
    isTracking = true;
    activeToken = token;
    expiresAt = expiry;
    installCursor();
    showTooltip(browser.i18n.getMessage('picktooltip'));
    document.addEventListener('pointermove', onPointerMove, { capture: true, passive: true });
    document.addEventListener('click', onElementClick, { capture: true, passive: false });
    scheduleExpiry();
    return getState();
  }

  function onElementClick(event) {
    if (!isTracking || !activeToken) return;

    const element = getEventElement(event);
    const token = activeToken;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    if (!element) {
      stopTracking();
      return;
    }

    const selector = createUniqueSelector(element);
    stopTracking({ keepTooltip: true });

    sendRuntimeMessage({
      action: ACTIONS.selectElement,
      token,
      selector
    }).then(response => {
      if (response?.accepted) {
        showTooltip(
          `${browser.i18n.getMessage('selectedtooltip')}: ${selector}`,
          event.clientX,
          event.clientY
        );
        tooltipRemovalTimer = setTimeout(removeTooltip, 900);
      } else {
        removeTooltip();
      }
    }).catch(removeTooltip);
  }

  function onMessage(request, sender, sendResponse) {
    let state;

    if (request?.action === ACTIONS.getState) {
      state = getState();
    } else if (request?.action === ACTIONS.start) {
      state = startTracking(request.token, request.expiresAt);
    } else if (request?.action === ACTIONS.stop) {
      state = stopTracking({ token: request.token });
    } else {
      return false;
    }

    sendResponse({ source: SOURCE, ok: true, state });
    return false;
  }

  function destroy() {
    stopTracking();
    browser.runtime.onMessage.removeListener(onMessage);
    window.removeEventListener('pagehide', destroy);
    delete globalThis[CONTROLLER_KEY];
  }

  const controller = {
    version: '1.21.1',
    destroy,
    getState,
    startTracking,
    stopTracking
  };

  globalThis[CONTROLLER_KEY] = controller;
  browser.runtime.onMessage.addListener(onMessage);
  window.addEventListener('pagehide', destroy, { once: true });

  sendRuntimeMessage({ action: ACTIONS.pickerReady })
    .then(response => {
      if (response?.session) {
        startTracking(response.session.token, response.session.expiresAt);
      }
    })
    .catch(() => {});
})();

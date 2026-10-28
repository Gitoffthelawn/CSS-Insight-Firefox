function showModalWithCSSData(cssData) {
  const modalKey = '__CSS_INSIGHT_DETAILS_MODAL__';
  globalThis[modalKey]?.close?.();

  const host = document.createElement('div');
  host.setAttribute('role', 'dialog');
  host.setAttribute('aria-modal', 'true');
  host.setAttribute('aria-label', browser.i18n.getMessage('infoheader'));
  host.style.setProperty('all', 'initial', 'important');
  host.style.setProperty('position', 'fixed', 'important');
  host.style.setProperty('inset', '0', 'important');
  host.style.setProperty('display', 'block', 'important');
  host.style.setProperty('z-index', '2147483647', 'important');

  const shadow = host.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = `
    :host { color-scheme: light; }
    .backdrop {
      display: flex;
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      padding: 16px;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.55);
      font-family: system-ui, sans-serif;
    }
    .panel {
      display: flex;
      box-sizing: border-box;
      width: min(760px, 100%);
      height: min(82vh, 900px);
      padding: 16px;
      flex-direction: column;
      gap: 12px;
      border-radius: 10px;
      background: #fff;
      box-shadow: 0 18px 60px rgba(0, 0, 0, 0.35);
    }
    textarea {
      box-sizing: border-box;
      width: 100%;
      min-height: 0;
      flex: 1;
      padding: 12px;
      resize: none;
      border: 1px solid #9fb3c8;
      border-radius: 6px;
      background: #f8fafc;
      color: #102a43;
      font: 13px/1.45 ui-monospace, SFMono-Regular, Consolas, monospace;
    }
    textarea:focus-visible,
    button:focus-visible {
      outline: 3px solid #62d9ff;
      outline-offset: 2px;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
    button {
      min-height: 42px;
      padding: 8px 16px;
      border: 0;
      border-radius: 6px;
      background: #0069d9;
      color: #fff;
      cursor: pointer;
      font: 600 14px/1.2 system-ui, sans-serif;
    }
    button:hover { background: #0056b3; }
  `;

  const backdrop = document.createElement('div');
  backdrop.className = 'backdrop';
  const panel = document.createElement('div');
  panel.className = 'panel';
  const textArea = document.createElement('textarea');
  textArea.readOnly = true;
  textArea.value = String(cssData || '');
  textArea.setAttribute('aria-label', browser.i18n.getMessage('infoheader'));

  const actions = document.createElement('div');
  actions.className = 'actions';
  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.textContent = browser.i18n.getMessage('close');
  const copyButton = document.createElement('button');
  copyButton.type = 'button';
  copyButton.textContent = browser.i18n.getMessage('copytext');
  let modalController = null;

  function closeModal() {
    document.removeEventListener('keydown', onKeyDown, true);
    host.remove();

    if (globalThis[modalKey] === modalController) {
      delete globalThis[modalKey];
    }
  }

  function onKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeModal();
    }
  }

  closeButton.addEventListener('click', closeModal);
  copyButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(textArea.value);
      copyButton.textContent = browser.i18n.getMessage('copied');
    } catch {
      copyButton.textContent = browser.i18n.getMessage('copyfailed');
    }
  });
  backdrop.addEventListener('click', event => {
    if (event.target === backdrop) closeModal();
  });
  document.addEventListener('keydown', onKeyDown, true);

  actions.append(closeButton, copyButton);
  panel.append(textArea, actions);
  backdrop.appendChild(panel);
  shadow.append(style, backdrop);
  (document.documentElement || document.body).appendChild(host);
  modalController = { close: closeModal, host };
  globalThis[modalKey] = modalController;
  closeButton.focus();

  return true;
}

showModalWithCSSData(globalThis.__CSS_INSIGHT_DATA__);

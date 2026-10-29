(() => {
function showModalWithCSSData(cssData) {
  const modalKey = '__CSS_INSIGHT_DETAILS_MODAL__';
  globalThis[modalKey]?.close?.();

  const previouslyFocused = document.activeElement;
  const host = document.createElement('div');
  host.style.setProperty('all', 'initial', 'important');
  const shadow = host.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = `
    :host { color-scheme: light; }
    dialog {
      box-sizing: border-box;
      width: min(760px, calc(100vw - 32px));
      height: min(82vh, 900px);
      max-width: none;
      max-height: none;
      padding: 0;
      overflow: hidden;
      border: 0;
      border-radius: 10px;
      background: #fff;
      color: #102a43;
      box-shadow: 0 18px 60px rgba(0, 0, 0, 0.35);
      font-family: system-ui, sans-serif;
    }
    dialog::backdrop { background: rgba(0, 0, 0, 0.55); }
    .panel {
      display: flex;
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      padding: 16px;
      flex-direction: column;
      gap: 12px;
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
      outline: 3px solid #0077a3;
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

  const dialog = document.createElement('dialog');
  dialog.setAttribute('aria-label', browser.i18n.getMessage('infoheader'));
  dialog.dir = browser.i18n.getMessage('@@bidi_dir') || 'ltr';
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
  let closed = false;

  function closeModal() {
    if (closed) return;
    closed = true;

    if (dialog.open) dialog.close();
    host.remove();

    if (globalThis[modalKey] === modalController) {
      delete globalThis[modalKey];
    }

    try {
      previouslyFocused?.focus?.({ preventScroll: true });
    } catch {
      previouslyFocused?.focus?.();
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
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    closeModal();
  });
  dialog.addEventListener('click', event => {
    if (event.target === dialog) closeModal();
  });

  actions.append(closeButton, copyButton);
  panel.append(textArea, actions);
  dialog.appendChild(panel);
  shadow.append(style, dialog);
  (document.documentElement || document.body).appendChild(host);
  modalController = { close: closeModal, host };
  globalThis[modalKey] = modalController;
  dialog.showModal();
  closeButton.focus();

  return true;
}

globalThis.__CSS_INSIGHT_OPERATIONS__ = {
  ...globalThis.__CSS_INSIGHT_OPERATIONS__,
  showModalWithCSSData
};
})();

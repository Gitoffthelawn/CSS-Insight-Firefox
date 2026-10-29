document.addEventListener('DOMContentLoaded', () => {
  const extensionI18n = browser.i18n;
  const uiLocale = extensionI18n.getMessage('@@ui_locale');
  const bidiDirection = extensionI18n.getMessage('@@bidi_dir');

  if (uiLocale) document.documentElement.lang = uiLocale.replace(/_/g, '-');
  if (bidiDirection === 'ltr' || bidiDirection === 'rtl') {
    document.documentElement.dir = bidiDirection;
  }

  for (const element of document.querySelectorAll('[data-i18n]')) {
    const message = extensionI18n.getMessage(element.dataset.i18n);
    if (message) element.textContent = message;
  }

  for (const element of document.querySelectorAll('[data-i18n-alt]')) {
    const message = extensionI18n.getMessage(element.dataset.i18nAlt);
    if (message) element.alt = message;
  }

  const params = new URLSearchParams(location.search);
  document.getElementById('version').textContent = params.get('version') || '-';
  document.getElementById('close-btn').addEventListener('click', () => window.close());
});

import { t } from './t.js';

const uiLocale = browser.i18n.getMessage('@@ui_locale');
const bidiDirection = browser.i18n.getMessage('@@bidi_dir');

if (uiLocale) {
  document.documentElement.lang = uiLocale.replace(/_/g, '-');
}

if (bidiDirection === 'ltr' || bidiDirection === 'rtl') {
  document.documentElement.dir = bidiDirection;
}

for (const element of document.querySelectorAll('[data-i18n]')) {
  element.textContent = t(element.dataset.i18n);
}

for (const element of document.querySelectorAll('[data-i18n-placeholder]')) {
  element.placeholder = t(element.dataset.i18nPlaceholder);
}

for (const element of document.querySelectorAll('[data-i18n-aria-label]')) {
  element.setAttribute('aria-label', t(element.dataset.i18nAriaLabel));
}

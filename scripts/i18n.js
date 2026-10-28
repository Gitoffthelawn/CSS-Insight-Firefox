import { t } from './t.js';

for (const element of document.querySelectorAll('[data-i18n]')) {
  element.textContent = t(element.dataset.i18n);
}

for (const element of document.querySelectorAll('[data-i18n-placeholder]')) {
  element.placeholder = t(element.dataset.i18nPlaceholder);
}

for (const element of document.querySelectorAll('[data-i18n-aria-label]')) {
  element.setAttribute('aria-label', t(element.dataset.i18nAriaLabel));
}

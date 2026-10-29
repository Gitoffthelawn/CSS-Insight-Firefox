export function t(key, substitutions) {
  return browser.i18n.getMessage(key, substitutions) || key;
}

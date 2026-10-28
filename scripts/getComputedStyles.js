function getComputedStyles(selector) {
  const INVALID_SELECTOR = browser.i18n.getMessage('invalidselector');
  const NOT_FOUND = browser.i18n.getMessage('notfound');
  const FOUND = browser.i18n.getMessage('found');
  const safeSelector = String(selector)
    .replace(/\*\//g, '* /')
    .replace(/[\r\n]+/g, ' ')
    .trim();
  let element;

  try {
    element = document.querySelector(selector);
  } catch {
    return `/* ${INVALID_SELECTOR} "${safeSelector}" */`;
  }

  if (!element) {
    return `/* ${NOT_FOUND} "${safeSelector}" */`;
  }

  const computedStyle = window.getComputedStyle(element);
  let result = `/* ${FOUND} "${safeSelector}": */\n\n`;

  for (let property of computedStyle) {
    result += `${property}: ${computedStyle.getPropertyValue(property)};\n`;
  }

  return result.trim();
}

getComputedStyles(globalThis.__CSS_INSIGHT_DATA__);

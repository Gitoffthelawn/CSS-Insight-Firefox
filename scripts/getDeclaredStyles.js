function sanitizeStyleSource(value) {
  return String(value)
    .replace(/\*\//g, '* /')
    .replace(/[\r\n]+/g, ' ')
    .trim();
}

function getStyleSource(sheet) {
  if (!sheet) {
    return browser.i18n.getMessage('sourceunknown');
  }

  if (sheet.href) {
    return sanitizeStyleSource(sheet.href);
  }

  const owner = sheet.ownerNode;

  if (owner?.dataset?.cssInsightPreview === 'true') {
    return browser.i18n.getMessage('sourcepreview');
  }

  if (owner?.localName === 'style') {
    const inlineLabel = browser.i18n.getMessage('sourceinline');
    const ownerId = sanitizeStyleSource(owner.id || '');

    if (ownerId) {
      return `${inlineLabel} (id="${ownerId}")`;
    }

    const styleIndex = Array.from(document.querySelectorAll('style')).indexOf(owner);
    return styleIndex >= 0 ? `${inlineLabel} #${styleIndex + 1}` : inlineLabel;
  }

  if (!owner) {
    return browser.i18n.getMessage('sourceconstructed');
  }

  return browser.i18n.getMessage('sourceunknown');
}

function getDeclaredStyles(selector = 'body') {
  const FOUND = browser.i18n.getMessage('found');
  const INVALID_SELECTOR = browser.i18n.getMessage('invalidselector');
  const NO_RULES = browser.i18n.getMessage('norules');
  const NOT_FOUND = browser.i18n.getMessage('notfound');
  const WAS_ERROR = browser.i18n.getMessage('waserror');
  const utilities = globalThis.__CSS_INSIGHT_STYLE_UTILS__;
  const safeSelector = utilities.sanitizeCssComment(selector);
  let elements;

  try {
    elements = Array.from(document.querySelectorAll(selector));
  } catch {
    return `/* ${INVALID_SELECTOR} "${safeSelector}" */`;
  }

  if (!elements.length) {
    return `/* ${NOT_FOUND} "${safeSelector}" */`;
  }

  const matchedRules = new Set();
  let result = '';

  utilities.walkStyleSheets(
    document,
    (rule, ancestors, sheet) => {
      if (!rule?.selectorText || matchedRules.has(rule)) return;

      const matches = elements.some(element =>
        utilities.selectorMatchesElement(rule, ancestors, element)
      );

      if (!matches) return;
      matchedRules.add(rule);
      result += `/* ${FOUND} "${safeSelector}" (${getStyleSource(sheet)}): */\n`;
      result += `${utilities.formatRuleWithAncestors(rule, ancestors)}\n\n`;
    },
    (error, sheet) => {
      console.warn(error?.message || error);
      const message = utilities.sanitizeCssComment(WAS_ERROR);
      result += `/* ${message} (${getStyleSource(sheet)}) */\n\n`;
    }
  );

  return result.trim() || `/* ${NO_RULES} "${safeSelector}" */`;
}

getDeclaredStyles(globalThis.__CSS_INSIGHT_DATA__);

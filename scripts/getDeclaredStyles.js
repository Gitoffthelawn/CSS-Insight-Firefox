(() => {
function sanitizeStyleSource(value) {
  return String(value)
    .replace(/\*\//g, '* /')
    .replace(/[\r\n]+/g, ' ')
    .trim();
}

function getStyleSource(sheet, root) {
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

    const styleIndex = Array.from(root.querySelectorAll('style')).indexOf(owner);
    return styleIndex >= 0 ? `${inlineLabel} #${styleIndex + 1}` : inlineLabel;
  }

  if (!owner) {
    return browser.i18n.getMessage('sourceconstructed');
  }

  return browser.i18n.getMessage('sourceunknown');
}

function getDeclaredStyles(request = 'body') {
  const FOUND = browser.i18n.getMessage('found');
  const INVALID_SELECTOR = browser.i18n.getMessage('invalidselector');
  const NO_RULES = browser.i18n.getMessage('norules');
  const NOT_FOUND = browser.i18n.getMessage('notfound');
  const TARGET_UNAVAILABLE = browser.i18n.getMessage('targetunavailable');
  const WAS_ERROR = browser.i18n.getMessage('waserror');
  const utilities = globalThis.__CSS_INSIGHT_STYLE_UTILS__;
  const targetUtilities = globalThis.__CSS_INSIGHT_TARGET_UTILS__;
  const target = targetUtilities.normalizeInspectionTarget(request);
  const root = targetUtilities.resolveInspectionRoot(target);
  const selector = target.selector;
  const safeSelector = utilities.sanitizeCssComment(selector);
  let elements;

  if (!root) {
    return `/* ${TARGET_UNAVAILABLE} */`;
  }

  try {
    elements = Array.from(root.querySelectorAll(selector));
  } catch {
    return `/* ${INVALID_SELECTOR} "${safeSelector}" */`;
  }

  if (!elements.length) {
    return `/* ${NOT_FOUND} "${safeSelector}" */`;
  }

  const matchedRules = new Set();
  let result = '';

  utilities.walkStyleSheets(
    root,
    (rule, ancestors, sheet) => {
      if (!rule?.selectorText || matchedRules.has(rule)) return;

      const matches = elements.some(element =>
        utilities.selectorMatchesElement(rule, ancestors, element)
      );

      if (!matches) return;
      matchedRules.add(rule);
      result += `/* ${FOUND} "${safeSelector}" (${getStyleSource(sheet, root)}): */\n`;
      result += `${utilities.formatRuleWithAncestors(rule, ancestors)}\n\n`;
    },
    (error, sheet) => {
      console.warn(error?.message || error);
      const message = utilities.sanitizeCssComment(WAS_ERROR);
      result += `/* ${message} (${getStyleSource(sheet, root)}) */\n\n`;
    }
  );

  return result.trim() || `/* ${NO_RULES} "${safeSelector}" */`;
}

globalThis.__CSS_INSIGHT_OPERATIONS__ = {
  ...globalThis.__CSS_INSIGHT_OPERATIONS__,
  getDeclaredStyles
};
})();

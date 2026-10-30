(() => {
function getKeyframes(request = {}) {
  const NO_KEYFRAMES = browser.i18n.getMessage('nokeyframes');
  const TARGET_UNAVAILABLE = browser.i18n.getMessage('targetunavailable');
  const WAS_ERROR = browser.i18n.getMessage('waserror');
  const utilities = globalThis.__CSS_INSIGHT_STYLE_UTILS__;
  const targetUtilities = globalThis.__CSS_INSIGHT_TARGET_UTILS__;
  const root = targetUtilities.resolveInspectionRoot(request);
  const entries = [];
  const notices = [];
  let keyframes = '';

  if (!root) return `/* ${TARGET_UNAVAILABLE} */`;

  utilities.walkStyleSheets(
    root,
    (rule, ancestors) => {
      if (utilities.isKeyframesRule(rule)) {
        const entry = utilities.formatRuleWithAncestors(rule, ancestors);
        entries.push({ text: entry, searchText: entry });
        keyframes += `${entry}\n\n`;
      }
    },
    error => {
      console.warn(error?.message || error);
      const notice = `/* ${utilities.sanitizeCssComment(WAS_ERROR)} */`;
      notices.push(notice);
      keyframes += `${notice}\n\n`;
    }
  );

  if (request?.structured === true && entries.length) {
    return {
      type: 'css-insight-filterable-styles',
      kind: 'keyframes',
      entries,
      notices
    };
  }

  return keyframes ? keyframes.trim() : `/* ${NO_KEYFRAMES} */`;
}

globalThis.__CSS_INSIGHT_OPERATIONS__ = {
  ...globalThis.__CSS_INSIGHT_OPERATIONS__,
  getKeyframes
};
})();

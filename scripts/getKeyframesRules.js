(() => {
function getKeyframes(request = {}) {
  const NO_KEYFRAMES = browser.i18n.getMessage('nokeyframes');
  const TARGET_UNAVAILABLE = browser.i18n.getMessage('targetunavailable');
  const WAS_ERROR = browser.i18n.getMessage('waserror');
  const utilities = globalThis.__CSS_INSIGHT_STYLE_UTILS__;
  const targetUtilities = globalThis.__CSS_INSIGHT_TARGET_UTILS__;
  const root = targetUtilities.resolveInspectionRoot(request);
  let keyframes = '';

  if (!root) return `/* ${TARGET_UNAVAILABLE} */`;

  utilities.walkStyleSheets(
    root,
    (rule, ancestors) => {
      if (utilities.isKeyframesRule(rule)) {
        keyframes += `${utilities.formatRuleWithAncestors(rule, ancestors)}\n\n`;
      }
    },
    error => {
      console.warn(error?.message || error);
      keyframes += `/* ${utilities.sanitizeCssComment(WAS_ERROR)} */\n\n`;
    }
  );

  return keyframes ? keyframes.trim() : `/* ${NO_KEYFRAMES} */`;
}

globalThis.__CSS_INSIGHT_OPERATIONS__ = {
  ...globalThis.__CSS_INSIGHT_OPERATIONS__,
  getKeyframes
};
})();

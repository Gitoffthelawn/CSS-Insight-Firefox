function getMediaRules(request = {}) {
  const NO_MEDIA = browser.i18n.getMessage('nomedia');
  const TARGET_UNAVAILABLE = browser.i18n.getMessage('targetunavailable');
  const WAS_ERROR = browser.i18n.getMessage('waserror');
  const utilities = globalThis.__CSS_INSIGHT_STYLE_UTILS__;
  const targetUtilities = globalThis.__CSS_INSIGHT_TARGET_UTILS__;
  const root = targetUtilities.resolveInspectionRoot(request);
  let mediaRules = '';

  if (!root) return `/* ${TARGET_UNAVAILABLE} */`;

  utilities.walkStyleSheets(
    root,
    (rule, ancestors) => {
      if (utilities.isMediaRule(rule)) {
        mediaRules += `${utilities.formatRuleWithAncestors(rule, ancestors)}\n\n`;
      }
    },
    error => {
      console.warn(error?.message || error);
      mediaRules += `/* ${utilities.sanitizeCssComment(WAS_ERROR)} */\n\n`;
    }
  );

  return mediaRules ? mediaRules.trim() : `/* ${NO_MEDIA} */`;
}

getMediaRules(globalThis.__CSS_INSIGHT_DATA__);

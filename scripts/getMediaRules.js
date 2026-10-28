function getMediaRules() {
  const NO_MEDIA = browser.i18n.getMessage('nomedia');
  const WAS_ERROR = browser.i18n.getMessage('waserror');
  const utilities = globalThis.__CSS_INSIGHT_STYLE_UTILS__;
  let mediaRules = '';

  utilities.walkStyleSheets(
    document,
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

getMediaRules();

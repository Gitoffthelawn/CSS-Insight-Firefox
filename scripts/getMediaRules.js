(() => {
function getMediaRules(request = {}) {
  const NO_MEDIA = browser.i18n.getMessage('nomedia');
  const TARGET_UNAVAILABLE = browser.i18n.getMessage('targetunavailable');
  const WAS_ERROR = browser.i18n.getMessage('waserror');
  const MEDIA_MATCHES = browser.i18n.getMessage('mediamatches');
  const MEDIA_DOES_NOT_MATCH = browser.i18n.getMessage('mediadoesnotmatch');
  const utilities = globalThis.__CSS_INSIGHT_STYLE_UTILS__;
  const targetUtilities = globalThis.__CSS_INSIGHT_TARGET_UTILS__;
  const root = targetUtilities.resolveInspectionRoot(request);
  let mediaRules = '';

  if (!root) return `/* ${TARGET_UNAVAILABLE} */`;

  function mediaConditionsMatch(rule, ancestors) {
    const mediaRules = [...ancestors, rule].filter(candidate =>
      utilities.isMediaRule(candidate)
    );

    try {
      return mediaRules.every(candidate => {
        const query = candidate.media?.mediaText || candidate.conditionText || '';
        return window.matchMedia(query).matches;
      });
    } catch {
      return null;
    }
  }

  utilities.walkStyleSheets(
    root,
    (rule, ancestors) => {
      if (utilities.isMediaRule(rule)) {
        const matches = mediaConditionsMatch(rule, ancestors);
        const status = matches === null
          ? ''
          : `/* ${utilities.sanitizeCssComment(
            matches ? MEDIA_MATCHES : MEDIA_DOES_NOT_MATCH
          )} */\n`;
        mediaRules += `${status}${utilities.formatRuleWithAncestors(rule, ancestors)}\n\n`;
      }
    },
    error => {
      console.warn(error?.message || error);
      mediaRules += `/* ${utilities.sanitizeCssComment(WAS_ERROR)} */\n\n`;
    }
  );

  return mediaRules ? mediaRules.trim() : `/* ${NO_MEDIA} */`;
}

globalThis.__CSS_INSIGHT_OPERATIONS__ = {
  ...globalThis.__CSS_INSIGHT_OPERATIONS__,
  getMediaRules
};
})();

function getMediaRules() {
  const NO_MEDIA = browser.i18n.getMessage('nomedia');
  const WAS_ERROR = browser.i18n.getMessage('waserror');
  let mediaRules = '';
  
  for (let stylesheet of document.styleSheets) {
    try {
      for (let rule of stylesheet.cssRules) {
        if (rule instanceof CSSMediaRule) {
          mediaRules += formatRule(rule) + '\n\n';
        }
      }
    } catch (e) {
      console.warn(e.message);
      mediaRules += `/* ${WAS_ERROR} */`;
    }
  }
  
  return mediaRules ? mediaRules.trim() : `/* ${NO_MEDIA} */`;
}

getMediaRules();
function getDeclaredStyles(selector = 'body') {
  const NO_RULES = browser.i18n.getMessage('norules');
  const WAS_ERROR = browser.i18n.getMessage('waserror');
  const FOUND = browser.i18n.getMessage('found');
  const stylesheets = document.styleSheets;
  let result = '';
  let subSelectors = getSubSelectors(selector);
  
  for (const sheet of stylesheets) {
    try {
      const rules = sheet.cssRules || sheet.rules;
      
      for (const rule of rules) {
        for (const _selector of subSelectors) {
          if (rule.selectorText?.includes(_selector)) {
            result += `${FOUND} "${_selector}": \n`;
            result += formatRule(rule) + '\n\n';
          }
        }
      }
    } catch (e) {
      console.warn(e.message);
      result += WAS_ERROR;
    }
  }
  
  return result.length ?
    result :
    `${NO_RULES} "${selector}"`;
}

getDeclaredStyles(data);
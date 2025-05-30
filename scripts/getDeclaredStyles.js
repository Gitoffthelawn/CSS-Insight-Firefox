function extractSubSelectorsFromRule(selectorText) {
  const selectors = selectorText.toLowerCase().split(',').map(s => s.trim());
  const parts = new Set();
  
  for (const sel of selectors) {
    const matches = sel.match(/^[a-z0-9-]+|#[\w-]+|\.[\w-]+/g);
    if (matches) {
      for (const m of matches) {
        parts.add(m);
      }
    }
  }
  
  return Array.from(parts);
}

function checkRule(rule, userSelector) {
  if (!rule.selectorText) return false;
  
  const ruleParts = extractSubSelectorsFromRule(rule.selectorText);
  const userParts = getSubSelectors(userSelector);
  
  return userParts.every(part => ruleParts.includes(part));
}

function getDeclaredStyles(selector = 'body') {
  const NO_RULES = browser.i18n.getMessage('norules');
  const WAS_ERROR = browser.i18n.getMessage('waserror');
  const FOUND = browser.i18n.getMessage('found');
  const stylesheets = document.styleSheets;
  let result = '';
  let subSelectors = getSubSelectors(selector);
  
  for (const sheet of stylesheets) {
    if (subSelectors === null) break;
    
    try {
      const rules = sheet.cssRules || sheet.rules;
      
      for (const rule of rules) {
        for (const _selector of subSelectors) {
          if (checkRule(rule, _selector)) {
            result += `/* ${FOUND} "${_selector}"(${rule.parentStyleSheet?.href}): */\n`;
            result += formatRule(rule) + '\n\n';
          }
        }
      }
    } catch (e) {
      console.warn(e.message);
      result += `${WAS_ERROR}`;
    }
  }
  
  return result.length ?
    result :
    `/* ${NO_RULES} "${selector} */"`;
}

getDeclaredStyles(data);
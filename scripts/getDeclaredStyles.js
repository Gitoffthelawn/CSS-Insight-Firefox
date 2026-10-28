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
  const userParts = globalThis.__CSS_INSIGHT_STYLE_UTILS__.getSubSelectors(userSelector);
  
  return userParts.every(part => ruleParts.includes(part));
}

function sanitizeStyleSource(value) {
  return String(value)
    .replace(/\*\//g, '* /')
    .replace(/[\r\n]+/g, ' ')
    .trim();
}

function getStyleSource(rule) {
  const sheet = rule.parentStyleSheet;

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
  const NO_RULES = browser.i18n.getMessage('norules');
  const WAS_ERROR = browser.i18n.getMessage('waserror');
  const FOUND = browser.i18n.getMessage('found');
  const stylesheets = document.styleSheets;
  let result = '';
  let subSelectors = globalThis.__CSS_INSIGHT_STYLE_UTILS__.getSubSelectors(selector);
  
  for (const sheet of stylesheets) {
    if (subSelectors === null) break;
    
    try {
      const rules = sheet.cssRules || sheet.rules;
      
      for (const rule of rules) {
        for (const _selector of subSelectors) {
          if (checkRule(rule, _selector)) {
            result += `/* ${FOUND} "${_selector}"(${getStyleSource(rule)}): */\n`;
            result += globalThis.__CSS_INSIGHT_STYLE_UTILS__.formatRule(rule) + '\n\n';
          }
        }
      }
    } catch (e) {
      console.warn(e.message);
      result += `/* ${WAS_ERROR} */`;
    }
  }
  
  return result.length ?
    result :
    `/* ${NO_RULES} "${selector} */"`;
}

getDeclaredStyles(globalThis.__CSS_INSIGHT_DATA__);

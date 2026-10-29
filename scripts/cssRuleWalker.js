(() => {
function collectStyleSheets(root = document) {
  const sheets = [];
  const seen = new Set();

  for (const collection of [root?.styleSheets, root?.adoptedStyleSheets]) {
    if (!collection) continue;

    for (const sheet of collection) {
      if (!sheet || seen.has(sheet)) continue;
      seen.add(sheet);
      sheets.push(sheet);
    }
  }

  return sheets;
}

function walkStyleSheets(root, onRule, onError = () => {}) {
  const seenSheets = new Set();

  function reportError(error, sheet) {
    try {
      onError(error, sheet);
    } catch {
      // Error reporting must not stop inspection of the remaining sheets.
    }
  }

  function readRules(container, sheet) {
    try {
      return container?.cssRules ? Array.from(container.cssRules) : [];
    } catch (error) {
      reportError(error, sheet);
      return [];
    }
  }

  function visitRules(rules, sheet, ancestors) {
    for (const rule of rules) {
      onRule(rule, ancestors, sheet);

      if (rule?.styleSheet) {
        visitSheet(rule.styleSheet);
      }

      const nestedRules = readRules(rule, sheet);

      if (nestedRules.length) {
        visitRules(nestedRules, sheet, [...ancestors, rule]);
      }
    }
  }

  function visitSheet(sheet) {
    if (!sheet || seenSheets.has(sheet)) return;
    seenSheets.add(sheet);
    visitRules(readRules(sheet, sheet), sheet, []);
  }

  for (const sheet of collectStyleSheets(root)) {
    visitSheet(sheet);
  }
}

function findBlockStart(cssText) {
  let quote = '';
  let escaped = false;
  let parentheses = 0;
  let brackets = 0;

  for (let index = 0; index < cssText.length; index += 1) {
    const character = cssText[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (character === '\\') {
      escaped = true;
      continue;
    }

    if (quote) {
      if (character === quote) quote = '';
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
    } else if (character === '(') {
      parentheses += 1;
    } else if (character === ')') {
      parentheses = Math.max(0, parentheses - 1);
    } else if (character === '[') {
      brackets += 1;
    } else if (character === ']') {
      brackets = Math.max(0, brackets - 1);
    } else if (character === '{' && parentheses === 0 && brackets === 0) {
      return index;
    }
  }

  return -1;
}

function getRulePrelude(rule) {
  const cssText = String(rule?.cssText || '');
  const blockStart = findBlockStart(cssText);
  return blockStart >= 0 ? cssText.slice(0, blockStart).trim() : '';
}

function indentCss(cssText) {
  return String(cssText)
    .split('\n')
    .map(line => `  ${line}`)
    .join('\n');
}

function formatRuleWithAncestors(rule, ancestors = []) {
  const utilities = globalThis.__CSS_INSIGHT_STYLE_UTILS__ || {};
  const formatter = utilities.formatRule;
  let formatted = typeof formatter === 'function'
    ? formatter(rule)
    : String(rule?.cssText || '').trim();

  for (let index = ancestors.length - 1; index >= 0; index -= 1) {
    const prelude = getRulePrelude(ancestors[index]);

    if (prelude) {
      formatted = `${prelude} {\n${indentCss(formatted)}\n}`;
    }
  }

  return formatted.trim();
}

function splitSelectorList(selectorText) {
  const selectors = [];
  let start = 0;
  let quote = '';
  let escaped = false;
  let parentheses = 0;
  let brackets = 0;

  for (let index = 0; index < selectorText.length; index += 1) {
    const character = selectorText[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (character === '\\') {
      escaped = true;
      continue;
    }

    if (quote) {
      if (character === quote) quote = '';
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
    } else if (character === '(') {
      parentheses += 1;
    } else if (character === ')') {
      parentheses = Math.max(0, parentheses - 1);
    } else if (character === '[') {
      brackets += 1;
    } else if (character === ']') {
      brackets = Math.max(0, brackets - 1);
    } else if (character === ',' && parentheses === 0 && brackets === 0) {
      const selector = selectorText.slice(start, index).trim();
      if (selector) selectors.push(selector);
      start = index + 1;
    }
  }

  const selector = selectorText.slice(start).trim();
  if (selector) selectors.push(selector);
  return selectors;
}

function replaceNestingSelector(selectorText, parentSelector) {
  let result = '';
  let quote = '';
  let escaped = false;

  for (const character of selectorText) {
    if (escaped) {
      result += character;
      escaped = false;
      continue;
    }

    if (character === '\\') {
      result += character;
      escaped = true;
      continue;
    }

    if (quote) {
      result += character;
      if (character === quote) quote = '';
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      result += character;
    } else if (character === '&') {
      result += `:is(${parentSelector})`;
    } else {
      result += character;
    }
  }

  return result;
}

function resolveRuleSelector(rule, ancestors = []) {
  let parentSelector = '';

  for (const ancestor of ancestors) {
    const selector = String(ancestor?.selectorText || '').trim();

    if (!selector) continue;
    parentSelector = parentSelector && selector.includes('&')
      ? replaceNestingSelector(selector, parentSelector)
      : selector;
  }

  const selector = String(rule?.selectorText || '').trim();

  return parentSelector && selector.includes('&')
    ? replaceNestingSelector(selector, parentSelector)
    : selector;
}

function stripTopLevelPseudoElement(selectorText) {
  let quote = '';
  let escaped = false;
  let parentheses = 0;
  let brackets = 0;

  for (let index = 0; index < selectorText.length - 1; index += 1) {
    const character = selectorText[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (character === '\\') {
      escaped = true;
      continue;
    }

    if (quote) {
      if (character === quote) quote = '';
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
    } else if (character === '(') {
      parentheses += 1;
    } else if (character === ')') {
      parentheses = Math.max(0, parentheses - 1);
    } else if (character === '[') {
      brackets += 1;
    } else if (character === ']') {
      brackets = Math.max(0, brackets - 1);
    } else if (character === ':' && selectorText[index + 1] === ':' &&
        parentheses === 0 && brackets === 0) {
      return selectorText.slice(0, index).trim();
    }
  }

  return selectorText;
}

const TRANSIENT_PSEUDO_CLASSES = new Set([
  'active',
  'autofill',
  'buffering',
  'checked',
  'default',
  'disabled',
  'enabled',
  'focus',
  'focus-visible',
  'focus-within',
  'fullscreen',
  'hover',
  'indeterminate',
  'invalid',
  'modal',
  'muted',
  'open',
  'optional',
  'paused',
  'picture-in-picture',
  'placeholder-shown',
  'playing',
  'popover-open',
  'read-only',
  'read-write',
  'required',
  'seeking',
  'stalled',
  'target',
  'target-within',
  'user-invalid',
  'user-valid',
  'valid',
  'visited',
  'volume-locked'
]);

function stripTransientPseudoClasses(selectorText) {
  let result = '';
  let quote = '';
  let escaped = false;
  let parentheses = 0;
  let brackets = 0;

  for (let index = 0; index < selectorText.length; index += 1) {
    const character = selectorText[index];

    if (escaped) {
      result += character;
      escaped = false;
      continue;
    }

    if (character === '\\') {
      result += character;
      escaped = true;
      continue;
    }

    if (quote) {
      result += character;
      if (character === quote) quote = '';
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      result += character;
    } else if (character === '(') {
      parentheses += 1;
      result += character;
    } else if (character === ')') {
      parentheses = Math.max(0, parentheses - 1);
      result += character;
    } else if (character === '[') {
      brackets += 1;
      result += character;
    } else if (character === ']') {
      brackets = Math.max(0, brackets - 1);
      result += character;
    } else if (character === ':' && selectorText[index + 1] !== ':' &&
        parentheses === 0 && brackets === 0) {
      const match = selectorText.slice(index + 1).match(/^[a-zA-Z-]+/);
      const name = match?.[0]?.toLowerCase() || '';

      if (TRANSIENT_PSEUDO_CLASSES.has(name)) {
        index += name.length;
      } else {
        result += character;
      }
    } else {
      result += character;
    }
  }

  return result.trim();
}

function selectorMatchesElement(rule, ancestors, element) {
  if (!element || typeof element.matches !== 'function') return false;
  const selectorText = resolveRuleSelector(rule, ancestors);

  for (const selector of splitSelectorList(selectorText)) {
    const elementSelector = stripTopLevelPseudoElement(selector);
    const relaxedSelector = stripTransientPseudoClasses(elementSelector);
    const candidates = new Set([selector, elementSelector, relaxedSelector]);

    for (const candidate of candidates) {
      if (!candidate) continue;
      try {
        if (element.matches(candidate)) return true;
      } catch {
        // Unsupported selector syntax does not invalidate other rules.
      }
    }
  }

  return false;
}

function sanitizeCssComment(value) {
  return String(value)
    .replace(/\*\//g, '* /')
    .replace(/[\r\n]+/g, ' ')
    .trim();
}

function hasRuleType(rule, constantName, constructorName) {
  const ruleType = globalThis.CSSRule?.[constantName];
  return (Number.isInteger(ruleType) && rule?.type === ruleType) ||
    rule?.constructor?.name === constructorName;
}

function isMediaRule(rule) {
  return hasRuleType(rule, 'MEDIA_RULE', 'CSSMediaRule');
}

function isKeyframesRule(rule) {
  return hasRuleType(rule, 'KEYFRAMES_RULE', 'CSSKeyframesRule');
}

globalThis.__CSS_INSIGHT_STYLE_UTILS__ = {
  ...globalThis.__CSS_INSIGHT_STYLE_UTILS__,
  collectStyleSheets,
  formatRuleWithAncestors,
  isKeyframesRule,
  isMediaRule,
  sanitizeCssComment,
  selectorMatchesElement,
  splitSelectorList,
  walkStyleSheets
};
})();

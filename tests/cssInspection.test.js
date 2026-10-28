import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const helperSource = await readFile(
  new URL('../scripts/cssRuleWalker.js', import.meta.url),
  'utf8'
);
const formatRuleSource = await readFile(
  new URL('../scripts/formatRule.js', import.meta.url),
  'utf8'
);
const declaredStylesSource = await readFile(
  new URL('../scripts/getDeclaredStyles.js', import.meta.url),
  'utf8'
);
const computedStylesSource = await readFile(
  new URL('../scripts/getComputedStyles.js', import.meta.url),
  'utf8'
);
const mediaRulesSource = await readFile(
  new URL('../scripts/getMediaRules.js', import.meta.url),
  'utf8'
);
const keyframesRulesSource = await readFile(
  new URL('../scripts/getKeyframesRules.js', import.meta.url),
  'utf8'
);

const messages = {
  found: 'Found rule for selector',
  invalidselector: 'Invalid CSS selector',
  norules: 'No rules for selector',
  notfound: 'No elements found for selector',
  sourceconstructed: 'constructed stylesheet',
  sourceinline: 'inline <style>',
  sourcepreview: 'CSS Insight preview',
  sourceunknown: 'unknown stylesheet',
  waserror: 'A stylesheet could not be read'
};

function makeContext(document) {
  const extensionApi = {
    i18n: {
      getMessage(key) {
        return messages[key] || key;
      }
    }
  };

  return vm.createContext({
    browser: extensionApi,
    chrome: extensionApi,
    console: { warn() {} },
    CSSKeyframesRule: class CSSKeyframesRule {},
    CSSMediaRule: class CSSMediaRule {},
    CSSRule: { KEYFRAMES_RULE: 7, MEDIA_RULE: 4 },
    CSSSupportsRule: class CSSSupportsRule {},
    document,
    __CSS_INSIGHT_DATA__: '.card'
  });
}

function loadUtilities(context) {
  vm.runInContext(`(() => { ${formatRuleSource} })()`, context);
  vm.runInContext(`(() => { ${helperSource} })()`, context);
  return vm.runInContext('__CSS_INSIGHT_STYLE_UTILS__', context);
}

test('combines regular and adopted stylesheets without duplicates', () => {
  const shared = { cssRules: [] };
  const adopted = { cssRules: [] };
  const context = makeContext({
    styleSheets: [shared],
    adoptedStyleSheets: [shared, adopted]
  });
  const utilities = loadUtilities(context);

  assert.deepEqual(
    Array.from(utilities.collectStyleSheets(context.document)),
    [shared, adopted]
  );
});

test('walks nested CSSOM rules and preserves their parent at-rules', () => {
  const leaf = {
    cssText: '.card { color: red; }',
    selectorText: '.card'
  };
  const media = {
    cssRules: [leaf],
    cssText: '@media (min-width: 30rem) { .card { color: red; } }',
    type: 4
  };
  const layer = {
    cssRules: [media],
    cssText: '@layer components { @media (min-width: 30rem) { .card { color: red; } } }'
  };
  const sheet = { cssRules: [layer] };
  leaf.parentStyleSheet = sheet;
  const context = makeContext({ styleSheets: [sheet], adoptedStyleSheets: [] });
  const utilities = loadUtilities(context);
  const visited = [];

  utilities.walkStyleSheets(context.document, (rule, ancestors) => {
    visited.push({ rule, ancestors: Array.from(ancestors) });
  });

  assert.deepEqual(visited.map(item => item.rule), [layer, media, leaf]);
  assert.deepEqual(visited[2].ancestors, [layer, media]);
  assert.match(
    utilities.formatRuleWithAncestors(leaf, visited[2].ancestors),
    /@layer components\s*{[\s\S]*@media \(min-width: 30rem\)\s*{[\s\S]*\.card/
  );
});

test('matches nested, pseudo-element and transient-state selectors safely', () => {
  const context = makeContext({ styleSheets: [], adoptedStyleSheets: [] });
  const utilities = loadUtilities(context);
  const element = {
    matches(selector) {
      return selector === ':is(.shell) > .card' || selector === '.card';
    }
  };

  assert.deepEqual(
    Array.from(utilities.splitSelectorList(':is(.a, .b), [data-label=","]')),
    [':is(.a, .b)', '[data-label=","]']
  );
  assert.equal(utilities.selectorMatchesElement(
    { selectorText: '& > .card' },
    [{ selectorText: '.shell' }],
    element
  ), true);
  assert.equal(utilities.selectorMatchesElement(
    { selectorText: '.card:hover::before' },
    [],
    element
  ), true);
});

test('declared styles use real selector matching and include adopted sheets', () => {
  const element = {
    matches(selector) {
      return selector === '.card';
    }
  };
  const nestedRule = {
    cssText: '.card { color: red; }',
    selectorText: '.card'
  };
  const unrelatedRule = {
    cssText: '.other, .unrelated { color: blue; }',
    selectorText: '.other, .unrelated'
  };
  const media = {
    cssRules: [nestedRule, unrelatedRule],
    cssText: '@media (min-width: 30rem) { .card { color: red; } }',
    type: 4
  };
  const linkedSheet = {
    cssRules: [media],
    href: 'https://example.com/site.css',
    ownerNode: { localName: 'link' }
  };
  const pseudoRule = {
    cssText: '.card::before { content: ""; }',
    selectorText: '.card::before'
  };
  const adoptedSheet = {
    cssRules: [pseudoRule],
    href: null,
    ownerNode: null
  };
  nestedRule.parentStyleSheet = linkedSheet;
  unrelatedRule.parentStyleSheet = linkedSheet;
  pseudoRule.parentStyleSheet = adoptedSheet;
  const document = {
    adoptedStyleSheets: [adoptedSheet],
    styleSheets: [linkedSheet],
    querySelectorAll(selector) {
      if (selector === 'style') return [];
      if (selector === '.card') return [element];
      if (selector === '[') throw new SyntaxError('Invalid selector');
      return [];
    }
  };
  const context = makeContext(document);

  loadUtilities(context);
  const result = vm.runInContext(declaredStylesSource, context);

  assert.match(result, /@media \(min-width: 30rem\)/);
  assert.match(result, /\.card \{\s*color: red;/);
  assert.match(result, /\.card::before/);
  assert.match(result, /constructed stylesheet/);
  assert.doesNotMatch(result, /\.other, \.unrelated/);

  context.__CSS_INSIGHT_DATA__ = '[';
  const invalidResult = vm.runInContext(declaredStylesSource, context);
  assert.match(invalidResult, /Invalid CSS selector/);
});

test('computed styles return a stable message for an invalid selector', () => {
  const context = makeContext({
    querySelector() {
      throw new SyntaxError('Invalid selector');
    }
  });
  context.__CSS_INSIGHT_DATA__ = '[';
  context.window = { getComputedStyle() {} };

  const result = vm.runInContext(computedStylesSource, context);
  assert.match(result, /Invalid CSS selector/);
});

test('media and keyframe collectors retain nested grouping context', () => {
  const mediaRule = {
    cssRules: [],
    cssText: '@media (width > 20rem) { .card { display: grid; } }',
    type: 4
  };
  const keyframesRule = {
    cssRules: [],
    cssText: '@keyframes fade { from { opacity: 0; } to { opacity: 1; } }',
    type: 7
  };
  const layerRule = {
    cssRules: [mediaRule, keyframesRule],
    cssText: '@layer components { @media (width > 20rem) {} @keyframes fade {} }'
  };
  const context = makeContext({
    styleSheets: [],
    adoptedStyleSheets: [{ cssRules: [layerRule] }]
  });

  loadUtilities(context);
  const mediaResult = vm.runInContext(mediaRulesSource, context);
  const keyframesResult = vm.runInContext(keyframesRulesSource, context);

  assert.match(mediaResult, /@layer components[\s\S]*@media \(width > 20rem\)/);
  assert.match(keyframesResult, /@layer components[\s\S]*@keyframes fade/);
});

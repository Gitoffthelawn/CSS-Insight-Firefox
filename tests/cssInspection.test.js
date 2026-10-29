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
const inspectionTargetSource = await readFile(
  new URL('../scripts/inspectionTarget.js', import.meta.url),
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
  mediamatches: 'Media conditions match the current environment.',
  mediadoesnotmatch: 'Media conditions do not match the current environment.',
  sourceconstructed: 'constructed stylesheet',
  sourceinline: 'inline <style>',
  sourcepreview: 'CSS Insight preview',
  sourceunknown: 'unknown stylesheet',
  targetunavailable: 'The selected target is unavailable',
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
    window: {
      matchMedia: query => ({ matches: true, media: query })
    },
    __CSS_INSIGHT_DATA__: '.card'
  });
}

function loadUtilities(context) {
  vm.runInContext(`(() => { ${formatRuleSource} })()`, context);
  vm.runInContext(`(() => { ${inspectionTargetSource} })()`, context);
  vm.runInContext(`(() => { ${helperSource} })()`, context);
  return vm.runInContext('__CSS_INSIGHT_STYLE_UTILS__', context);
}

function runOperation(context, source, operation, data = context.__CSS_INSIGHT_DATA__) {
  vm.runInContext(source, context);
  return context.__CSS_INSIGHT_OPERATIONS__[operation](data);
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
  const result = runOperation(context, declaredStylesSource, 'getDeclaredStyles');

  assert.match(result, /@media \(min-width: 30rem\)/);
  assert.match(result, /\.card \{\s*color: red;/);
  assert.match(result, /\.card::before/);
  assert.match(result, /constructed stylesheet/);
  assert.doesNotMatch(result, /\.other, \.unrelated/);

  context.__CSS_INSIGHT_DATA__ = '[';
  const invalidResult = runOperation(context, declaredStylesSource, 'getDeclaredStyles');
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
  vm.runInContext(`(() => { ${inspectionTargetSource} })()`, context);

  const result = runOperation(context, computedStylesSource, 'getComputedStyles');
  assert.match(result, /Invalid CSS selector/);
});

test('declared and computed styles resolve the selected open shadow root', () => {
  const element = {
    matches(selector) {
      return selector === '.control';
    }
  };
  const owner = { localName: 'style', id: 'component', dataset: {} };
  const rule = {
    cssText: '.control { color: rebeccapurple; }',
    selectorText: '.control'
  };
  const mediaRule = {
    cssRules: [rule],
    cssText: '@media (width > 10rem) { .control { color: rebeccapurple; } }',
    type: 4
  };
  const keyframesRule = {
    cssRules: [],
    cssText: '@keyframes pulse { from { opacity: .8; } to { opacity: 1; } }',
    type: 7
  };
  const sheet = { cssRules: [mediaRule, keyframesRule], href: null, ownerNode: owner };
  rule.parentStyleSheet = sheet;
  const shadowRoot = {
    adoptedStyleSheets: [],
    styleSheets: [sheet],
    querySelector(selector) {
      return selector === '.control' ? element : null;
    },
    querySelectorAll(selector) {
      if (selector === 'style') return [owner];
      return selector === '.control' ? [element] : [];
    }
  };
  const document = {
    adoptedStyleSheets: [],
    styleSheets: [],
    querySelector(selector) {
      return selector === 'app-shell' ? { shadowRoot } : null;
    },
    querySelectorAll() { return []; }
  };
  const context = makeContext(document);
  const computedStyle = ['color'];
  computedStyle.getPropertyValue = property =>
    property === 'color' ? 'rgb(102, 51, 153)' : '';
  context.window = {
    getComputedStyle: () => computedStyle,
    matchMedia: query => ({ matches: true, media: query })
  };
  context.__CSS_INSIGHT_DATA__ = {
    selector: '.control',
    shadowPath: ['app-shell']
  };

  loadUtilities(context);
  const declaredResult = runOperation(context, declaredStylesSource, 'getDeclaredStyles');
  const computedResult = runOperation(context, computedStylesSource, 'getComputedStyles');
  const mediaResult = runOperation(context, mediaRulesSource, 'getMediaRules');
  const keyframesResult = runOperation(context, keyframesRulesSource, 'getKeyframes');

  assert.match(declaredResult, /@media \(width > 10rem\)/);
  assert.match(declaredResult, /\.control \{\s*color: rebeccapurple;/);
  assert.match(declaredResult, /inline <style> \(id="component"\)/);
  assert.match(computedResult, /color: rgb\(102, 51, 153\);/);
  assert.match(mediaResult, /@media \(width > 10rem\)/);
  assert.match(mediaResult, /Media conditions match the current environment/);
  assert.match(keyframesResult, /@keyframes pulse/);
});

test('media and keyframe collectors retain nested grouping context', () => {
  const mediaRule = {
    cssRules: [],
    cssText: '@media (width > 20rem) { .card { display: grid; } }',
    media: { mediaText: '(width > 20rem)' },
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
  context.window.matchMedia = query => ({
    matches: query !== '(width > 20rem)',
    media: query
  });

  loadUtilities(context);
  const mediaResult = runOperation(context, mediaRulesSource, 'getMediaRules');
  const keyframesResult = runOperation(context, keyframesRulesSource, 'getKeyframes');

  assert.match(mediaResult, /@layer components[\s\S]*@media \(width > 20rem\)/);
  assert.match(mediaResult, /Media conditions do not match the current environment/);
  assert.match(keyframesResult, /@layer components[\s\S]*@keyframes fade/);
});

test('computed styles can return structured properties for popup filtering', () => {
  const computedStyle = ['color', 'display'];
  computedStyle.getPropertyValue = property => ({
    color: 'rgb(1, 2, 3)',
    display: 'grid'
  })[property];
  const context = makeContext({
    querySelector: selector => selector === '.card' ? {} : null
  });
  context.window.getComputedStyle = () => computedStyle;
  context.__CSS_INSIGHT_DATA__ = { selector: '.card', structured: true };

  vm.runInContext(`(() => { ${inspectionTargetSource} })()`, context);
  const result = JSON.parse(JSON.stringify(
    runOperation(context, computedStylesSource, 'getComputedStyles')
  ));

  assert.equal(result.type, 'css-insight-computed-styles');
  assert.deepEqual(result.properties, [
    { name: 'color', value: 'rgb(1, 2, 3)' },
    { name: 'display', value: 'grid' }
  ]);
});

test('helper and collector scripts can be evaluated repeatedly in one content scope', () => {
  const context = makeContext({ styleSheets: [], adoptedStyleSheets: [] });

  assert.doesNotThrow(() => {
    loadUtilities(context);
    loadUtilities(context);
    vm.runInContext(mediaRulesSource, context);
    vm.runInContext(mediaRulesSource, context);
    vm.runInContext(keyframesRulesSource, context);
    vm.runInContext(keyframesRulesSource, context);
  });

  assert.equal(typeof context.__CSS_INSIGHT_OPERATIONS__.getMediaRules, 'function');
  assert.equal(typeof context.__CSS_INSIGHT_OPERATIONS__.getKeyframes, 'function');
});

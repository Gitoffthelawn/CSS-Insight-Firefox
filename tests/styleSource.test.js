import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(
  new URL('../scripts/getDeclaredStyles.js', import.meta.url),
  'utf8'
);
const formatRuleSource = await readFile(
  new URL('../scripts/formatRule.js', import.meta.url),
  'utf8'
);
const cssRuleWalkerSource = await readFile(
  new URL('../scripts/cssRuleWalker.js', import.meta.url),
  'utf8'
);

const messages = {
  invalidselector: 'Invalid selector',
  norules: 'No rules',
  notfound: 'Not found',
  waserror: 'Error',
  found: 'Found',
  sourceinline: 'inline <style>',
  sourcepreview: 'CSS Insight preview',
  sourceconstructed: 'constructed stylesheet',
  sourceunknown: 'unknown stylesheet'
};

function makeSheet(href, ownerNode) {
  const sheet = { href, ownerNode, cssRules: [] };
  const rule = {
    selectorText: 'body',
    cssText: 'body { color: red; }',
    parentStyleSheet: sheet
  };

  sheet.cssRules.push(rule);
  return sheet;
}

function readDeclaredStyles(styleSheets, styleElements) {
  const selectedElement = {
    matches(selector) {
      return selector === 'body';
    }
  };
  const context = vm.createContext({
    browser: {
      i18n: {
        getMessage(key) {
          return messages[key] || key;
        }
      }
    },
    console: { warn() {} },
    document: {
      adoptedStyleSheets: [],
      styleSheets,
      querySelectorAll(selector) {
        if (selector === 'style') return styleElements;
        return selector === 'body' ? [selectedElement] : [];
      }
    },
    CSSMediaRule: class CSSMediaRule {},
    CSSSupportsRule: class CSSSupportsRule {},
    CSSKeyframesRule: class CSSKeyframesRule {},
    __CSS_INSIGHT_DATA__: 'body'
  });

  vm.runInContext(`(() => { ${formatRuleSource} })()`, context);
  vm.runInContext(`(() => { ${cssRuleWalkerSource} })()`, context);
  assert.equal(vm.runInContext('typeof formatRule', context), 'undefined');
  assert.equal(vm.runInContext('typeof collectStyleSheets', context), 'undefined');

  return vm.runInContext(source, context);
}

test('describes linked, inline, preview and constructed style sources', () => {
  const namedStyle = {
    localName: 'style',
    id: 'theme',
    dataset: {}
  };
  const anonymousStyle = {
    localName: 'style',
    id: '',
    dataset: {}
  };
  const previewStyle = {
    localName: 'style',
    id: '',
    dataset: { cssInsightPreview: 'true' }
  };
  const styleElements = [namedStyle, anonymousStyle, previewStyle];
  const result = readDeclaredStyles([
    makeSheet('https://example.com/site.css', { localName: 'link' }),
    makeSheet(null, namedStyle),
    makeSheet(null, anonymousStyle),
    makeSheet(null, previewStyle),
    makeSheet(null, null),
    makeSheet(null, { localName: 'link' })
  ], styleElements);

  assert.match(result, /https:\/\/example\.com\/site\.css/);
  assert.match(result, /inline <style> \(id="theme"\)/);
  assert.match(result, /inline <style> #2/);
  assert.match(result, /CSS Insight preview/);
  assert.match(result, /constructed stylesheet/);
  assert.match(result, /unknown stylesheet/);
  assert.doesNotMatch(result, /\(null\)/);
});

test('keeps source metadata inside the generated CSS comment', () => {
  const style = {
    localName: 'style',
    id: 'theme*/\nunsafe',
    dataset: {}
  };
  const result = readDeclaredStyles([makeSheet(null, style)], [style]);

  assert.match(result, /theme\* \/ unsafe/);
  assert.equal((result.match(/\*\//g) || []).length, 1);
});

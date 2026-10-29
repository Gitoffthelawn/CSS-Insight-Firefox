import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterComputedStyles,
  isComputedStylesResult
} from '../scripts/displayStyles.js';

const result = {
  type: 'css-insight-computed-styles',
  header: '/* Found rule for selector ".card": */',
  properties: [
    { name: 'color', value: 'rgb(1, 2, 3)' },
    { name: 'display', value: 'grid' },
    { name: 'grid-template-columns', value: '1fr 2fr' }
  ]
};

test('filters computed properties by name or value without losing the header', () => {
  assert.equal(isComputedStylesResult(result), true);

  const byName = filterComputedStyles(result, 'grid', 'No matches');
  assert.equal(byName.matchCount, 2);
  assert.match(byName.text, /Found rule for selector/);
  assert.match(byName.text, /display: grid;/);
  assert.match(byName.text, /grid-template-columns: 1fr 2fr;/);
  assert.doesNotMatch(byName.text, /color:/);

  const byValue = filterComputedStyles(result, 'rgb', 'No matches');
  assert.equal(byValue.matchCount, 1);
  assert.match(byValue.text, /color: rgb\(1, 2, 3\);/);
});

test('returns a safe localized message when no computed property matches', () => {
  const filtered = filterComputedStyles(result, 'animation', 'No */ matches');

  assert.equal(filtered.matchCount, 0);
  assert.match(filtered.text, /\/\* No \* \/ matches \*\//);
});

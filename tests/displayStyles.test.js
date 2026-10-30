import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterStylesResult,
  isFilterableStylesResult
} from '../scripts/displayStyles.js';

const computedResult = {
  type: 'css-insight-filterable-styles',
  kind: 'computed',
  header: '/* Found rule for selector ".card": */',
  entries: [
    { text: 'color: rgb(1, 2, 3);', searchText: 'color\nrgb(1, 2, 3)' },
    { text: 'display: grid;', searchText: 'display\ngrid' },
    {
      text: 'grid-template-columns: 1fr 2fr;',
      searchText: 'grid-template-columns\n1fr 2fr'
    }
  ]
};

test('filters computed entries by property name or value without losing the header', () => {
  assert.equal(isFilterableStylesResult(computedResult), true);

  const byName = filterStylesResult(computedResult, 'grid', 'No matches');
  assert.equal(byName.matchCount, 2);
  assert.match(byName.text, /Found rule for selector/);
  assert.match(byName.text, /display: grid;/);
  assert.match(byName.text, /grid-template-columns: 1fr 2fr;/);
  assert.doesNotMatch(byName.text, /color:/);

  const byValue = filterStylesResult(computedResult, 'rgb', 'No matches');
  assert.equal(byValue.matchCount, 1);
  assert.match(byValue.text, /color: rgb\(1, 2, 3\);/);
});

test('keeps complete CSS blocks and parent context when filtering collected rules', () => {
  const result = {
    type: 'css-insight-filterable-styles',
    kind: 'declared',
    entries: [
      {
        text: '/* inline <style> */\n@layer components {\n  @media (width > 30rem) {\n    .card { color: red; }\n  }\n}',
        searchText: 'inline <style> @layer components @media .card color red'
      },
      {
        text: '/* https://example.com/site.css */\n.other { display: grid; }',
        searchText: 'https://example.com/site.css .other display grid'
      }
    ]
  };

  const filtered = filterStylesResult(result, 'color', 'No matches');

  assert.equal(filtered.matchCount, 1);
  assert.match(filtered.text, /@layer components/);
  assert.match(filtered.text, /@media \(width > 30rem\)/);
  assert.match(filtered.text, /\.card \{ color: red; \}/);
  assert.doesNotMatch(filtered.text, /\.other/);
});

test('keeps stylesheet warnings visible while filtering rule entries', () => {
  const result = {
    type: 'css-insight-filterable-styles',
    kind: 'media',
    notices: ['/* A stylesheet could not be read. */'],
    entries: [
      { text: '@media (width > 40rem) { .grid { display: grid; } }' }
    ]
  };

  const filtered = filterStylesResult(result, 'animation', 'No */ matches');

  assert.equal(filtered.matchCount, 0);
  assert.match(filtered.text, /stylesheet could not be read/);
  assert.match(filtered.text, /\/\* No \* \/ matches \*\//);
  assert.doesNotMatch(filtered.text, /\.grid/);
});

test('rejects malformed structured results', () => {
  assert.equal(isFilterableStylesResult({
    type: 'css-insight-filterable-styles',
    kind: 'declared',
    entries: []
  }), false);
  assert.equal(isFilterableStylesResult('plain CSS'), false);
});

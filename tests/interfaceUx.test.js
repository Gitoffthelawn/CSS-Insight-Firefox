import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const popupHtml = await readFile(new URL('../popup.html', import.meta.url), 'utf8');
const popupSource = await readFile(new URL('../popup.js', import.meta.url), 'utf8');
const i18nSource = await readFile(new URL('../scripts/i18n.js', import.meta.url), 'utf8');
const modalSource = await readFile(
  new URL('../scripts/showModalWithCSSData.js', import.meta.url),
  'utf8'
);
const updateHtml = await readFile(new URL('../update/update.html', import.meta.url), 'utf8');
const updateSource = await readFile(new URL('../update/update.js', import.meta.url), 'utf8');

test('shows and resets the full inspection context', () => {
  assert.match(popupHtml, /id="targetContextValue"/);
  assert.match(popupHtml, /id="useActivePageBtn"/);
  assert.match(popupSource, /targetShadowPath\.join\(' >>> '\)/);
  assert.match(popupSource, /clearWindowPickerResult/);
});

test('offers explicit CSS preview removal in the selected root', () => {
  assert.match(popupHtml, /id="removeRuleBtn"/);
  assert.match(popupSource, /remove:\s*true/);
  assert.match(popupSource, /stylesremoved/);
});

test('filters every structured CSS result without another page query', () => {
  assert.match(popupHtml, /id="styleFilterInput"/);
  assert.match(popupSource, /filterStylesResult/);
  assert.match(popupSource, /getDeclaredStyles\.js'[\s\S]*structured:\s*true/);
  assert.match(popupSource, /getComputedStyles\.js'[\s\S]*structured:\s*true/);
  assert.match(popupSource, /getMediaRules\.js',\s*\{\s*structured:\s*true\s*\}/);
  assert.match(popupSource, /getKeyframesRules\.js',\s*\{\s*structured:\s*true\s*\}/);
});

test('uses browser locale metadata in extension documents', () => {
  assert.match(i18nSource, /@@ui_locale/);
  assert.match(i18nSource, /@@bidi_dir/);
  assert.match(updateSource, /@@ui_locale/);
  assert.match(updateSource, /@@bidi_dir/);
  assert.doesNotMatch(updateHtml, />What's New in CSS Insight</);
});

test('uses a native modal dialog and restores page focus', () => {
  assert.match(modalSource, /createElement\('dialog'\)/);
  assert.match(modalSource, /dialog\.showModal\(\)/);
  assert.match(modalSource, /previouslyFocused\?\.focus/);
  assert.match(modalSource, /addEventListener\('cancel'/);
});

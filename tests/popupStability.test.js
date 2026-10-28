import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const popupStyles = await readFile(
  new URL('../styles/popup.css', import.meta.url),
  'utf8'
);
const popupSource = await readFile(new URL('../popup.js', import.meta.url), 'utf8');
const backgroundSource = await readFile(
  new URL('../scripts/service_worker.js', import.meta.url),
  'utf8'
);

test('popup width is rooted in a fixed desktop geometry', () => {
  assert.match(popupStyles, /html\s*{[^}]*width:\s*360px;/s);
  assert.match(popupStyles, /html\s*{[^}]*scrollbar-gutter:\s*stable;/s);
  assert.match(popupStyles, /body\s*{[^}]*width:\s*100%;/s);
  assert.doesNotMatch(popupStyles, /max-width:\s*100vw/);
});

test('popup ignores unrelated storage changes and avoids identical DOM writes', () => {
  assert.match(popupSource, /if \(!sessionChange && !resultChange\) return;/);
  assert.match(popupSource, /trackTagBtn\.textContent !== pickerLabel/);
  assert.match(popupSource, /tagInput\.value !== pickerResult\.selector/);
});

test('background deduplicates repeated target tracking writes', () => {
  assert.match(
    backgroundSource,
    /trackedTabs\.get\(tab\.windowId\) === tab\.id/
  );
});

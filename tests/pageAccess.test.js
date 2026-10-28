import test from 'node:test';
import assert from 'node:assert/strict';

import { getPageAccess } from '../scripts/getPageAccess.js';

test('allows ordinary HTTP and HTTPS pages, including Google', () => {
  assert.equal(getPageAccess({ id: 1, url: 'https://www.google.com/search?q=css' }).allowed, true);
  assert.equal(getPageAccess({ id: 2, url: 'https://example.com/docs' }).allowed, true);
  assert.equal(getPageAccess({ id: 3, url: 'http://localhost:8080/' }).allowed, true);
});

test('allows local files so Firefox can enforce its own page rules', () => {
  assert.equal(getPageAccess({ id: 4, url: 'file:///tmp/example.html' }).allowed, true);
});

test('blocks Firefox Add-ons and other restricted Mozilla domains', () => {
  for (const url of [
    'https://addons.mozilla.org/firefox/addon/css-insight/',
    'https://support.mozilla.org/en-US/',
    'https://accounts.firefox.com/'
  ]) {
    assert.deepEqual(
      getPageAccess({ id: 5, url }),
      { allowed: false, messageKey: 'pageaccessmozilla' },
      url
    );
  }
});

test('blocks browser-internal and unsupported schemes', () => {
  for (const url of [
    'about:addons',
    'about:debugging',
    'moz-extension://example/page.html',
    'view-source:https://example.com/',
    'data:text/html,example',
    'blob:https://example.com/id'
  ]) {
    assert.deepEqual(
      getPageAccess({ id: 6, url }),
      { allowed: false, messageKey: 'pageaccessprotected' },
      url
    );
  }
});

test('reports a missing active page without throwing', () => {
  assert.deepEqual(getPageAccess(null), {
    allowed: false,
    messageKey: 'pageaccessmissing'
  });
  assert.deepEqual(getPageAccess({ id: 7, url: '' }), {
    allowed: false,
    messageKey: 'pageaccessmissing'
  });
});

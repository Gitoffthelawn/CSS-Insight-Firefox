import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getActiveTab,
  getCurrentWindowId,
  isExtensionPageUrl
} from '../scripts/getActiveTab.js';

test('recognizes only pages owned by the current extension', () => {
  const root = 'moz-extension://extension-id/';

  assert.equal(isExtensionPageUrl(`${root}popup.html`, root), true);
  assert.equal(isExtensionPageUrl(`${root}update/update.html`, root), true);
  assert.equal(isExtensionPageUrl('https://example.com/', root), false);
  assert.equal(isExtensionPageUrl('about:addons', root), false);
  assert.equal(isExtensionPageUrl('', root), false);
});

function installBrowserMock({ activeTab, trackedTab = null }) {
  const messages = [];

  globalThis.browser = {
    runtime: {
      getURL: () => 'moz-extension://extension-id/',
      async sendMessage(message) {
        messages.push(message);
        return message.action === 'cssInsight:getTrackedTarget'
          ? { ok: true, tab: trackedTab }
          : { ok: true };
      }
    },
    tabs: {
      async query() {
        return [activeTab];
      }
    }
  };

  return messages;
}

test('uses the visible regular page directly and remembers it', async t => {
  t.after(() => { delete globalThis.browser; });
  const page = {
    id: 7,
    windowId: 2,
    url: 'https://example.com/'
  };
  const messages = installBrowserMock({ activeTab: page });

  assert.equal(await getActiveTab(), page);
  assert.deepEqual(messages, [{
    action: 'cssInsight:rememberTarget',
    tabId: 7,
    windowId: 2
  }]);
});

test('reads the current window without changing its active tab', async t => {
  t.after(() => { delete globalThis.browser; });
  const page = { id: 7, windowId: 12, url: 'https://example.com/' };
  const messages = installBrowserMock({ activeTab: page });

  assert.equal(await getCurrentWindowId(), 12);
  assert.deepEqual(messages, []);
});

test('falls back to the tracked page only when the popup itself is active', async t => {
  t.after(() => { delete globalThis.browser; });
  const popup = {
    id: 9,
    windowId: 2,
    url: 'moz-extension://extension-id/popup.html'
  };
  const page = {
    id: 7,
    windowId: 2,
    url: 'https://example.com/'
  };
  const messages = installBrowserMock({ activeTab: popup, trackedTab: page });

  assert.equal(await getActiveTab(), page);
  assert.deepEqual(messages, [{
    action: 'cssInsight:getTrackedTarget',
    windowId: 2
  }]);
});

test('does not replace a protected Mozilla page with an older target', async t => {
  t.after(() => { delete globalThis.browser; });
  const protectedPage = {
    id: 11,
    windowId: 2,
    url: 'https://addons.mozilla.org/firefox/'
  };
  const messages = installBrowserMock({
    activeTab: protectedPage,
    trackedTab: { id: 7, windowId: 2, url: 'https://example.com/' }
  });

  assert.equal(await getActiveTab(), protectedPage);
  assert.deepEqual(messages, []);
});

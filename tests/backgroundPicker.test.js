import test from 'node:test';
import assert from 'node:assert/strict';

function createEvent() {
  return {
    listener: null,
    addListener(listener) {
      this.listener = listener;
    }
  };
}

function installBrowserMock({ silentMessage = () => false } = {}) {
  const stored = {};
  const storageWrites = [];
  const messages = [];
  const tabs = [
    { id: 1, windowId: 7, active: true, url: 'https://one.example/' },
    { id: 2, windowId: 7, active: false, url: 'https://two.example/' },
    { id: 3, windowId: 8, active: true, url: 'https://other.example/' }
  ];
  const events = {
    activated: createEvent(),
    updated: createEvent(),
    removed: createEvent(),
    message: createEvent(),
    startup: createEvent(),
    installed: createEvent()
  };

  globalThis.browser = {
    storage: {
      local: {
        async get(keys) {
          const requested = Array.isArray(keys) ? keys : [keys];
          return Object.fromEntries(requested
            .filter(key => key in stored)
            .map(key => [key, stored[key]]));
        },
        async set(value) {
          storageWrites.push(structuredClone(value));
          Object.assign(stored, structuredClone(value));
        }
      }
    },
    tabs: {
      async query(queryInfo) {
        return tabs.filter(tab =>
          (!Number.isInteger(queryInfo.windowId) || tab.windowId === queryInfo.windowId) &&
          (!queryInfo.active || tab.active)
        );
      },
      async get(tabId) {
        return tabs.find(tab => tab.id === tabId) || null;
      },
      async sendMessage(tabId, message) {
        messages.push({ tabId, message: structuredClone(message) });

        if (silentMessage(tabId, message)) {
          return new Promise(() => {});
        }

        return { source: 'css-insight-picker', ok: true };
      },
      async create() {},
      async remove() {},
      onActivated: events.activated,
      onUpdated: events.updated,
      onRemoved: events.removed
    },
    scripting: {
      async executeScript() {
        return [];
      }
    },
    runtime: {
      getManifest: () => ({ version: '1.23.1' }),
      getURL: path => `moz-extension://test/${path}`,
      onMessage: events.message,
      onStartup: events.startup,
      onInstalled: events.installed
    }
  };

  return { events, messages, stored, storageWrites, tabs };
}

function settleWithin(promise, timeoutMs = 1_500) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve({ timedOut: true }), timeoutMs);

    promise.then(value => {
      clearTimeout(timer);
      resolve(value);
    }, error => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

test('arms every eligible tab in one window and accepts only its first selection', async t => {
  const mock = installBrowserMock();
  t.after(() => { delete globalThis.browser; });

  const moduleUrl = new URL('../scripts/service_worker.js', import.meta.url);
  moduleUrl.searchParams.set('test', String(Date.now()));
  await import(moduleUrl);

  const armResponse = await mock.events.message.listener({
    action: 'cssInsight:armPicker',
    windowId: 7
  }, {});

  assert.equal(armResponse.ok, true);
  assert.equal(typeof armResponse.session.token, 'string');
  assert.deepEqual(
    mock.messages
      .filter(entry => entry.message.action === 'cssInsight:startPicker')
      .map(entry => entry.tabId)
      .sort(),
    [1, 2]
  );

  const selection = {
    action: 'cssInsight:selectElement',
    token: armResponse.session.token,
    selector: 'main > article',
    shadowPath: ['app-shell']
  };
  const winner = await mock.events.message.listener(selection, {
    tab: mock.tabs[1],
    frameId: 12,
    documentId: 'document-12'
  });
  const lateClick = await mock.events.message.listener(selection, {
    tab: mock.tabs[0]
  });

  assert.equal(winner.accepted, true);
  assert.equal(lateClick.accepted, false);
  assert.equal(mock.stored.cssInsightPickerState['7'].tabId, 2);
  assert.equal(mock.stored.cssInsightPickerState['7'].selector, 'main > article');
  assert.equal(mock.stored.cssInsightPickerState['7'].frameId, 12);
  assert.equal(mock.stored.cssInsightPickerState['7'].documentId, 'document-12');
  assert.deepEqual(mock.stored.cssInsightPickerState['7'].shadowPath, ['app-shell']);
  assert.equal('8' in mock.stored.cssInsightPickerState, false);
  assert.deepEqual(
    mock.messages
      .filter(entry => entry.message.action === 'cssInsight:stopPicker')
      .map(entry => entry.tabId)
      .sort(),
    [1, 2]
  );
});

test('a silent tab cannot permanently block a later picker session', async t => {
  const mock = installBrowserMock({
    silentMessage(tabId, message) {
      return tabId === 2 && message.action === 'cssInsight:stopPicker';
    }
  });
  t.after(() => { delete globalThis.browser; });

  const moduleUrl = new URL('../scripts/service_worker.js', import.meta.url);
  moduleUrl.searchParams.set('silent-tab-test', `${Date.now()}-${Math.random()}`);
  await import(moduleUrl);

  const firstArm = await mock.events.message.listener({
    action: 'cssInsight:armPicker',
    windowId: 7
  }, {});
  const selection = {
    action: 'cssInsight:selectElement',
    token: firstArm.session.token,
    selector: 'main'
  };
  const winnerPromise = mock.events.message.listener(selection, {
    tab: mock.tabs[0]
  });
  const nextArmPromise = mock.events.message.listener({
    action: 'cssInsight:armPicker',
    windowId: 7
  }, {});
  const [winner, nextArm] = await Promise.all([
    settleWithin(winnerPromise),
    settleWithin(nextArmPromise)
  ]);

  assert.equal(winner.timedOut, undefined);
  assert.equal(winner.accepted, true);
  assert.equal(nextArm.timedOut, undefined);
  assert.equal(nextArm.ok, true);
  assert.notEqual(nextArm.session.token, firstArm.session.token);

  const firstStopMessages = mock.messages.filter(entry =>
    entry.message.action === 'cssInsight:stopPicker'
  );

  assert.equal(firstStopMessages.length, 2);
  assert.ok(firstStopMessages.every(entry =>
    entry.message.token === firstArm.session.token
  ));
});

test('remembering the same target does not rewrite local storage', async t => {
  const mock = installBrowserMock();
  t.after(() => { delete globalThis.browser; });

  const moduleUrl = new URL('../scripts/service_worker.js', import.meta.url);
  moduleUrl.searchParams.set('target-write-test', `${Date.now()}-${Math.random()}`);
  await import(moduleUrl);

  const message = {
    action: 'cssInsight:rememberTarget',
    tabId: 1,
    windowId: 7
  };

  const first = await mock.events.message.listener(message, {});
  const second = await mock.events.message.listener(message, {});
  const targetWrites = mock.storageWrites.filter(value =>
    Object.hasOwn(value, 'cssInsightLastEligibleTabs')
  );

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(targetWrites.length, 1);
});

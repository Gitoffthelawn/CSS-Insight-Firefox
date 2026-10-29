import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ensureContentScripts,
  executeScript,
  sendTabMessage
} from '../scripts/common.js';

function installBrowserMock(handler) {
  const messages = [];
  const injections = [];

  globalThis.browser = {
    tabs: {
      sendMessage(tabId, message, options) {
        messages.push({ tabId, message: structuredClone(message), options: { ...options } });
        return handler({ tabId, message, options });
      }
    },
    scripting: {
      async executeScript(options) {
        injections.push(options);
        return [];
      }
    }
  };

  return { injections, messages };
}

test('page operations travel through the resident content runtime', async t => {
  const mock = installBrowserMock(({ message }) => {
    const responses = {
      'cssInsight:getPickerState': {
        source: 'css-insight-picker',
        ok: true
      },
      'cssInsight:getInspectionRuntimeState': {
        source: 'css-insight-inspection',
        ok: true,
        state: { instanceId: 'runtime-document-3' }
      },
      'cssInsight:runPageOperation': {
        source: 'css-insight-inspection',
        ok: true,
        result: 'matched media rules'
      }
    };
    return Promise.resolve(responses[message.action]);
  });
  t.after(() => { delete globalThis.browser; });

  const controllers = await ensureContentScripts(7, 3, 'document-3');
  const result = await executeScript(
    7,
    'scripts/getMediaRules.js',
    { shadowPath: [] },
    3,
    'document-3',
    controllers.runtimeInstanceId
  );

  assert.equal(result, 'matched media rules');
  assert.equal(mock.injections.length, 0);
  assert.equal(mock.messages.at(-1).message.operation, 'getMediaRules');
  assert.equal(mock.messages.at(-1).message.instanceId, 'runtime-document-3');
  assert.deepEqual(mock.messages.at(-1).options, { documentId: 'document-3' });
});

test('navigation between the runtime probe and operation cannot retarget the frame', async t => {
  let navigated = false;
  const mock = installBrowserMock(({ message, options }) => {
    if (message.action === 'cssInsight:getPickerState') {
      return Promise.resolve({ source: 'css-insight-picker', ok: true });
    }

    if (message.action === 'cssInsight:getInspectionRuntimeState') {
      return Promise.resolve({
        source: 'css-insight-inspection',
        ok: true,
        state: { instanceId: navigated ? 'runtime-new' : 'runtime-old' }
      });
    }

    if ('documentId' in options && navigated) {
      return Promise.reject(new Error('The document was unloaded.'));
    }

    return Promise.resolve(message.instanceId === 'runtime-new'
      ? { source: 'css-insight-inspection', ok: true, result: 'wrong document' }
      : {
          source: 'css-insight-inspection',
          ok: false,
          errorCode: 'runtime_changed'
        });
  });
  t.after(() => { delete globalThis.browser; });

  const controllers = await ensureContentScripts(7, 3, 'document-old');
  navigated = true;

  await assert.rejects(
    executeScript(
      7,
      'scripts/getMediaRules.js',
      {},
      3,
      'document-old',
      controllers.runtimeInstanceId
    ),
    error => error?.code === 'CSS_INSIGHT_RUNTIME_CHANGED'
  );

  const operationMessages = mock.messages.filter(entry =>
    entry.message.action === 'cssInsight:runPageOperation'
  );
  assert.deepEqual(operationMessages.map(entry => entry.options), [
    { documentId: 'document-old' },
    { frameId: 3 }
  ]);
});

test('message routing falls back from documentId to frameId', async t => {
  let calls = 0;
  const mock = installBrowserMock(({ options }) => {
    calls += 1;

    if ('documentId' in options) {
      return Promise.reject(new Error('documentId routing is unavailable'));
    }

    return Promise.resolve({ ok: true });
  });
  t.after(() => { delete globalThis.browser; });

  const response = await sendTabMessage(9, { action: 'probe' }, 5, 'document-5');

  assert.deepEqual(response, { ok: true });
  assert.equal(calls, 2);
  assert.deepEqual(mock.messages.map(entry => entry.options), [
    { documentId: 'document-5' },
    { frameId: 5 }
  ]);
});

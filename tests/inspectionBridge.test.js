import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const bridgeSource = await readFile(
  new URL('../scripts/inspectionBridge.js', import.meta.url),
  'utf8'
);

function createBridgeContext(instanceId = 'runtime-instance-1') {
  let listener = null;
  let listenerCount = 0;
  let operationCount = 0;
  const context = vm.createContext({
    Promise,
    crypto: { randomUUID: () => instanceId },
    window: {
      addEventListener() {},
      removeEventListener() {}
    },
    browser: {
      runtime: {
        onMessage: {
          addListener(value) {
            listener = value;
            listenerCount += 1;
          },
          removeListener(value) {
            if (listener === value) listener = null;
          }
        }
      }
    },
    __CSS_INSIGHT_OPERATIONS__: {
      echo: value => {
        operationCount += 1;
        return { received: value };
      },
      fail: () => { throw new Error('collector failed'); }
    }
  });

  return {
    context,
    getListener: () => listener,
    getListenerCount: () => listenerCount,
    getOperationCount: () => operationCount
  };
}

function send(listener, request) {
  return new Promise(resolve => {
    const keepAlive = listener(request, {}, resolve);

    if (keepAlive !== true) queueMicrotask(() => resolve(undefined));
  });
}

test('content runtime dispatches page operations and reports collector errors', async () => {
  const runtime = createBridgeContext();
  vm.runInContext(bridgeSource, runtime.context);
  const listener = runtime.getListener();

  const state = await send(listener, { action: 'cssInsight:getInspectionRuntimeState' });
  const success = await send(listener, {
    action: 'cssInsight:runPageOperation',
    instanceId: 'runtime-instance-1',
    operation: 'echo',
    data: 'media'
  });
  const failure = await send(listener, {
    action: 'cssInsight:runPageOperation',
    instanceId: 'runtime-instance-1',
    operation: 'fail'
  });

  assert.equal(state.source, 'css-insight-inspection');
  assert.equal(state.ok, true);
  assert.equal(state.state.instanceId, 'runtime-instance-1');
  assert.deepEqual(Array.from(state.state.operations), ['echo', 'fail']);
  assert.equal(success.ok, true);
  assert.deepEqual(success.result, { received: 'media' });
  assert.equal(failure.ok, false);
  assert.equal(failure.error, 'collector failed');
});

test('a replaced document runtime rejects a stale operation before it runs', async () => {
  const runtime = createBridgeContext('runtime-instance-2');
  vm.runInContext(bridgeSource, runtime.context);

  const response = await send(runtime.getListener(), {
    action: 'cssInsight:runPageOperation',
    instanceId: 'runtime-instance-1',
    operation: 'echo',
    data: 'must not run'
  });

  assert.equal(response.source, 'css-insight-inspection');
  assert.equal(response.ok, false);
  assert.equal(response.errorCode, 'runtime_changed');
  assert.equal(runtime.getOperationCount(), 0);
});

test('reloading the same bridge version does not duplicate its listener', () => {
  const runtime = createBridgeContext();

  vm.runInContext(bridgeSource, runtime.context);
  vm.runInContext(bridgeSource, runtime.context);

  assert.equal(runtime.getListenerCount(), 1);
  assert.equal(
    runtime.context.__CSS_INSIGHT_INSPECTION_BRIDGE__.getState().instanceId,
    'runtime-instance-1'
  );
});

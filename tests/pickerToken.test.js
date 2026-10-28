import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(
  new URL('../scripts/getTagName.js', import.meta.url),
  'utf8'
);

function createElement(localName) {
  return {
    localName,
    dataset: {},
    isConnected: false,
    style: { setProperty() {} },
    appendChild() {},
    attachShadow() {
      return { append() {} };
    },
    getBoundingClientRect() {
      return { width: 100, height: 20 };
    },
    remove() {
      this.isConnected = false;
    }
  };
}

function installController() {
  let messageListener = null;
  const appendChild = element => {
    element.isConnected = true;
  };
  const context = {
    CSS: { escape: value => String(value) },
    browser: {
      i18n: { getMessage: key => key },
      runtime: {
        async sendMessage() {
          return { ok: true, session: null };
        },
        onMessage: {
          addListener(listener) {
            messageListener = listener;
          },
          removeListener() {}
        }
      }
    },
    document: {
      addEventListener() {},
      removeEventListener() {},
      createElement,
      documentElement: { appendChild },
      head: { appendChild }
    },
    window: {
      innerWidth: 1_000,
      innerHeight: 800,
      addEventListener() {},
      removeEventListener() {}
    },
    setTimeout,
    clearTimeout,
    requestAnimationFrame: callback => setTimeout(callback, 0),
    cancelAnimationFrame: clearTimeout
  };

  vm.runInNewContext(source, context);
  return messageListener;
}

function sendPickerCommand(listener, request) {
  let response = null;
  listener(request, {}, value => { response = value; });
  return response.state;
}

test('a late stop from an old token cannot disable a newer picker', () => {
  const listener = installController();
  const expiry = Date.now() + 60_000;

  assert.equal(sendPickerCommand(listener, {
    action: 'cssInsight:startPicker',
    token: 'token-a',
    expiresAt: expiry
  }).token, 'token-a');
  assert.equal(sendPickerCommand(listener, {
    action: 'cssInsight:stopPicker',
    token: 'token-a'
  }).isTracking, false);
  assert.equal(sendPickerCommand(listener, {
    action: 'cssInsight:startPicker',
    token: 'token-b',
    expiresAt: expiry
  }).token, 'token-b');

  const afterLateStop = sendPickerCommand(listener, {
    action: 'cssInsight:stopPicker',
    token: 'token-a'
  });
  const afterLateStart = sendPickerCommand(listener, {
    action: 'cssInsight:startPicker',
    token: 'token-a',
    expiresAt: expiry
  });

  assert.equal(afterLateStop.token, 'token-b');
  assert.equal(afterLateStop.isTracking, true);
  assert.equal(afterLateStart.token, 'token-b');
  assert.equal(afterLateStart.isTracking, true);

  sendPickerCommand(listener, {
    action: 'cssInsight:stopPicker',
    token: 'token-b'
  });
});

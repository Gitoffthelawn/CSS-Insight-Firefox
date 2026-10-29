import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const targetSource = await readFile(
  new URL('../scripts/inspectionTarget.js', import.meta.url),
  'utf8'
);
const applyStylesSource = await readFile(
  new URL('../scripts/applyStyles.js', import.meta.url),
  'utf8'
);
const manifest = JSON.parse(await readFile(
  new URL('../manifest.json', import.meta.url),
  'utf8'
));
const popupSource = await readFile(new URL('../popup.js', import.meta.url), 'utf8');
const backgroundSource = await readFile(
  new URL('../scripts/service_worker.js', import.meta.url),
  'utf8'
);

function loadTargetUtilities(document) {
  const context = vm.createContext({
    CSS: { escape: value => String(value) },
    document
  });
  vm.runInContext(targetSource, context);
  return { context, utilities: context.__CSS_INSIGHT_TARGET_UTILS__ };
}

test('creates and resolves a selector path through nested open shadow roots', () => {
  const target = {
    nodeType: 1,
    localName: 'button',
    id: 'save',
    classList: [],
    parentElement: null
  };
  const innerHost = {
    nodeType: 1,
    localName: 'settings-panel',
    id: 'settings',
    classList: [],
    parentElement: null
  };
  const outerHost = {
    nodeType: 1,
    localName: 'app-shell',
    id: 'app',
    classList: [],
    parentElement: null
  };
  const innerRoot = {
    host: innerHost,
    querySelectorAll: selector => selector === '#save' ? [target] : [],
    querySelector: () => null
  };
  const outerRoot = {
    host: outerHost,
    querySelectorAll: selector => selector === '#settings' ? [innerHost] : [],
    querySelector: selector => selector === 'settings-panel#settings' ? innerHost : null
  };
  const document = {
    querySelectorAll: selector => selector === '#app' ? [outerHost] : [],
    querySelector: selector => selector === 'app-shell#app' ? outerHost : null
  };

  target.getRootNode = () => innerRoot;
  innerHost.getRootNode = () => outerRoot;
  innerHost.shadowRoot = innerRoot;
  outerHost.getRootNode = () => document;
  outerHost.shadowRoot = outerRoot;

  const { utilities } = loadTargetUtilities(document);
  const inspectionTarget = utilities.createInspectionTarget(target);

  assert.deepEqual(
    JSON.parse(JSON.stringify(inspectionTarget)),
    {
      selector: 'button#save',
      shadowPath: ['app-shell#app', 'settings-panel#settings']
    }
  );
  assert.equal(utilities.resolveInspectionRoot(inspectionTarget), innerRoot);
  assert.equal(
    utilities.formatInspectionTarget(inspectionTarget),
    'app-shell#app >>> settings-panel#settings >>> button#save'
  );
});

test('returns null when an open shadow target has been replaced', () => {
  const document = {
    querySelectorAll() { return []; },
    querySelector() { return null; }
  };
  const { utilities } = loadTargetUtilities(document);

  assert.equal(utilities.resolveInspectionRoot({
    selector: '.card',
    shadowPath: ['app-shell']
  }), null);
});

test('applies previews independently to the document and an open shadow root', () => {
  const appended = [];
  const shadowRoot = {
    appendChild(element) {
      element.isConnected = true;
      appended.push({ root: 'shadow', element });
    }
  };
  const host = { shadowRoot };
  const document = {
    head: {
      appendChild(element) {
        element.isConnected = true;
        appended.push({ root: 'document', element });
      }
    },
    createElement() {
      return {
        dataset: {},
        isConnected: false,
        textContent: '',
        remove() { this.isConnected = false; }
      };
    },
    querySelector(selector) {
      return selector === 'app-shell' ? host : null;
    },
    querySelectorAll() { return []; }
  };
  const context = vm.createContext({
    CSS: { escape: value => String(value) },
    WeakMap,
    browser: { i18n: { getMessage: key => key } },
    document,
    __CSS_INSIGHT_DATA__: { cssText: '.card { color: red; }', shadowPath: [] }
  });

  vm.runInContext(targetSource, context);
  assert.equal(vm.runInContext(applyStylesSource, context), true);
  context.__CSS_INSIGHT_DATA__ = {
    cssText: '.card { color: blue; }',
    shadowPath: ['app-shell']
  };
  assert.equal(vm.runInContext(applyStylesSource, context), true);

  assert.deepEqual(appended.map(entry => entry.root), ['document', 'shadow']);
  assert.equal(appended[0].element.textContent, '.card { color: red; }');
  assert.equal(appended[1].element.textContent, '.card { color: blue; }');

  context.__CSS_INSIGHT_DATA__ = { remove: true, shadowPath: ['app-shell'] };
  assert.equal(vm.runInContext(applyStylesSource, context), true);
  assert.equal(appended[1].element.isConnected, false);
  assert.equal(appended[0].element.isConnected, true);
  assert.equal(vm.runInContext(applyStylesSource, context), false);
});

test('declares and routes iframe picker contexts without new permissions', () => {
  const contentScript = manifest.content_scripts[0];

  assert.equal(contentScript.all_frames, true);
  assert.equal(contentScript.match_about_blank, true);
  assert.equal(contentScript.match_origin_as_fallback, true);
  assert.deepEqual(manifest.permissions, ['storage', 'tabs', 'activeTab', 'scripting']);
  assert.deepEqual(manifest.host_permissions, ['<all_urls>']);
  assert.match(backgroundSource, /selectElement\([\s\S]*?sender\.frameId/);
  assert.match(backgroundSource, /sender\.documentId/);
  assert.match(backgroundSource, /allFrames:\s*true/);
  assert.match(
    popupSource,
    /ensureContentScripts\(tab\.id, targetFrameId, targetDocumentId\)/
  );
  assert.match(popupSource, /context\.frameId/);
});

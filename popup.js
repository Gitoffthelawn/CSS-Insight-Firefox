import { executeScript } from './scripts/common.js';
import { displayStyles } from './scripts/displayStyles.js';
import { formatTagName } from './scripts/formatTagName.js';

const COPY = browser.i18n.getMessage('copytext');
const COPIED = browser.i18n.getMessage('copied');
const NO_DATA = browser.i18n.getMessage('nodata');
const STOP = browser.i18n.getMessage('tracktagstop');
const START = browser.i18n.getMessage('tracktagstart');

document.getElementById('declaredStylesBtn').addEventListener('click', () => {
  browser.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0].url?.startsWith("about:")) return undefined;
    const tabId = tabs[0].id;
    const selector = document.getElementById('tagInput').value || 'body';

    executeScript(tabId, './scripts/getDeclaredStyles.js', (result) => {
      const styleData = result[0].result;

      displayStyles(styleData);
    }, selector);
  });
});

document.getElementById('computedStylesBtn').addEventListener('click', () => {
  browser.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0].url?.startsWith("about:")) return undefined;
    const tabId = tabs[0].id;
    const selector = document.getElementById('tagInput').value || 'body';

    executeScript(tabId, './scripts/getComputedStyles.js', (result) => {
      const styleData = result[0].result;

      displayStyles(styleData);
    }, selector);
  });
});

document.getElementById('mediaRulesBtn').addEventListener('click', () => {
  browser.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0].url?.startsWith("about:")) return undefined;
    const tabId = tabs[0].id;

    executeScript(tabId, './scripts/getMediaRules.js', (result) => {
      const styleData = result[0].result;

      displayStyles(styleData);
    }, '');
  });
});

document.getElementById('keyframesRulesBtn').addEventListener('click', () => {
  browser.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0].url?.startsWith("about:")) return undefined;
    const tabId = tabs[0].id;

    executeScript(tabId, './scripts/getKeyframesRules.js', (result) => {
      const styleData = result[0].result;

      displayStyles(styleData);
    }, '');
  });
});

document.getElementById('copyBtn').addEventListener('click', () => {
  const text = document.getElementById('styleData').value;
  navigator.clipboard.writeText(text).then(() => {
    document.getElementById('copyBtn').textContent = COPIED;
    setTimeout(() => {
      document.getElementById('copyBtn').textContent = COPY;
    }, 3000);
  });
});

document.getElementById('moreDetailsBtn').addEventListener('click', () => {
  browser.storage.local.get('cssData', (result) => {
    const cssData = result.cssData || NO_DATA;

    browser.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0].url?.startsWith("about:")) return undefined;
      const tabId = tabs[0].id;

      executeScript(tabId, './scripts/showModalWithCSSData.js', (result) => {
        console.log(result, 'result');
      }, cssData);
    });
  });
});

document.getElementById('applyRuleBtn').addEventListener('click', () => {
  setTimeout(function() {
    document.getElementById('newRule').classList.remove('hidden');
  }, 0);
});

document.getElementById('injectCSSBtn').addEventListener('click', () => {
  browser.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0].url?.startsWith("about:")) return undefined;
    const tabId = tabs[0].id;
    const rule = document.getElementById('newRuleData').value;

    if (rule.length == 0) return;

    executeScript(tabId, './scripts/applyStyles.js', (result) => {
      console.log(result[0].result);
      document.getElementById('cssInfo').classList.add('hidden');
    }, rule);
  });
});

document.getElementById('hideCssInfo').addEventListener('click', () => {
  document.getElementById('cssInfo').classList.add('hidden');
});

document.getElementById('hideNewRule').addEventListener('click', () => {
  document.getElementById('newRule').classList.add('hidden');
});

const trackTagBtn = document.getElementById('trackTagBtn');
const tagInput = document.getElementById('tagInput');

browser.storage.sync.get(['isTracking', 'tagInfo'], function(result) {
  trackTagBtn.textContent = result.isTracking ? STOP : START;
  tagInput.value = result.tagInfo ?
    formatTagName(result.tagInfo) :
    '';
});

trackTagBtn.addEventListener('click', function() {
  browser.storage.sync.get(['isTracking', 'tagInfo'], function(result) {
    const isActive = result.isTracking;
    const tagInfo = result.tagInfo;

    if (isActive) {
      tagInput.value = tagInfo ?
        formatTagName(tagInfo) :
        '';
    }

    browser.storage.sync.set({ isTracking: !isActive }, function() {
      trackTagBtn.textContent = !isActive ? STOP : START;

      browser.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs[0].url?.startsWith("about:")) return undefined;
        browser.tabs.sendMessage(tabs[0].id, { action: !isActive ? 'start' : 'stop' });
      });
    });
  });
});
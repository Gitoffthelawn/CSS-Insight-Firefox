import { executeScript } from './scripts/common.js';
import { displayStyles } from './scripts/displayStyles.js';
import { formatTagName } from './scripts/formatTagName.js';
import { isBlockedURL } from './scripts/isBlockedURL.js';
import { getActiveTab } from './scripts/getActiveTab.js';
import { t } from "./scripts/t.js";

const COPY = t('copytext');
const COPIED = t('copied');
const NO_DATA = t('nodata');
const STOP = t('tracktagstop');
const START = t('tracktagstart');

document.getElementById('declaredStylesBtn').addEventListener('click', async () => {
  const tab = await getActiveTab();
  if (!tab || isBlockedURL([tab])) return;
  const selector = document.getElementById('tagInput').value || 'body';
  
  executeScript(tab.id, './scripts/getDeclaredStyles.js', (result) => {
    const styleData = result[0].result;
    displayStyles(styleData);
  }, selector);
});

document.getElementById('computedStylesBtn').addEventListener('click', async () => {
  const tab = await getActiveTab();
  if (!tab || isBlockedURL([tab])) return;
  const selector = document.getElementById('tagInput').value || 'body';
  
  executeScript(tab.id, './scripts/getComputedStyles.js', (result) => {
    const styleData = result[0].result;
    displayStyles(styleData);
  }, selector);
});

document.getElementById('mediaRulesBtn').addEventListener('click', async () => {
  const tab = await getActiveTab();
  if (!tab || isBlockedURL([tab])) return;
  
  executeScript(tab.id, './scripts/getMediaRules.js', (result) => {
    const styleData = result[0].result;
    displayStyles(styleData);
  }, '');
});

document.getElementById('keyframesRulesBtn').addEventListener('click', async () => {
  const tab = await getActiveTab();
  if (!tab || isBlockedURL([tab])) return;
  
  executeScript(tab.id, './scripts/getKeyframesRules.js', (result) => {
    const styleData = result[0].result;
    displayStyles(styleData);
  }, '');
});

document.getElementById('copyBtn').addEventListener('click', () => {
  const text = document.getElementById('styleData').innerText;
  navigator.clipboard.writeText(text).then(() => {
    document.getElementById('copyBtn').textContent = COPIED;
    setTimeout(() => { document.getElementById('copyBtn').textContent = COPY; }, 3000);
  });
});

document.getElementById('moreDetailsBtn').addEventListener('click', async () => {
  const result = await browser.storage.local.get('cssData');
  const cssData = result.cssData || NO_DATA;
  
  const tab = await getActiveTab();
  if (!tab || isBlockedURL([tab])) return;
  
  executeScript(tab.id, './scripts/showModalWithCSSData.js', (result) => { console.log(result, 'result'); }, cssData);
});

document.getElementById('saveBtn').addEventListener('click', () => {
  const cssCode = document.getElementById('styleData').textContent;
  const blob = new Blob([cssCode], { type: 'text/css' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = 'styles.css';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
});

document.getElementById('applyRuleBtn').addEventListener('click', () => {
  setTimeout(() => {
    document.getElementById('newRule').classList.remove('hidden');
  }, 0);
});

document.getElementById('injectCSSBtn').addEventListener('click', async () => {
  const tab = await getActiveTab();
  if (!tab || isBlockedURL([tab])) return;
  
  const rule = document.getElementById('newRuleData').value;
  if (rule.length === 0) return;
  
  executeScript(tab.id, './scripts/applyStyles.js', (result) => {
    console.log(result[0].result);
    document.getElementById('cssInfo').classList.add('hidden');
  }, rule);
});

document.getElementById('hideCssInfo').addEventListener('click', () => {
  document.getElementById('cssInfo').classList.add('hidden');
});

document.getElementById('hideNewRule').addEventListener('click', () => {
  document.getElementById('newRule').classList.add('hidden');
});

const trackTagBtn = document.getElementById('trackTagBtn');
const tagInput = document.getElementById('tagInput');

browser.storage.sync.get(['isTracking', 'tagInfo'], (result) => {
  trackTagBtn.textContent = result.isTracking ? STOP : START;
  tagInput.value = result.tagInfo ? formatTagName(result.tagInfo) : '';
});

trackTagBtn.addEventListener('click', async () => {
  browser.storage.sync.get(['isTracking', 'tagInfo'], async (result) => {
    const isActive = result.isTracking;
    const tagInfo = result.tagInfo;
    
    if (isActive) {
      tagInput.value = tagInfo ? formatTagName(tagInfo) : '';
    }
    
    browser.storage.sync.set({ isTracking: !isActive }, async () => {
      trackTagBtn.textContent = !isActive ? STOP : START;
      const tab = await getActiveTab();
      if (!tab || isBlockedURL([tab])) return;
      browser.tabs.sendMessage(tab.id, { action: !isActive ? 'start' : 'stop' });
    });
  });
});
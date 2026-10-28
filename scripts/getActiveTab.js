import { getPageAccess } from './getPageAccess.js';

const GET_TRACKED_TARGET = 'cssInsight:getTrackedTarget';
const REMEMBER_TARGET = 'cssInsight:rememberTarget';

export function isExtensionPageUrl(url, extensionRoot) {
  return typeof url === 'string' &&
    typeof extensionRoot === 'string' &&
    url.startsWith(extensionRoot);
}

export function getTabById(tabId) {
  return browser.tabs.get(tabId);
}

export async function getCurrentWindowId() {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  return Number.isInteger(tabs[0]?.windowId) ? tabs[0].windowId : null;
}

async function rememberTarget(tab) {
  try {
    await browser.runtime.sendMessage({
      action: REMEMBER_TARGET,
      tabId: tab.id,
      windowId: tab.windowId
    });
  } catch {
    // The current tab is still a valid target if the event page wakes slowly.
  }
}

export async function getActiveTab() {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const activeTab = tabs[0] || null;

  if (!activeTab) return null;

  if (getPageAccess(activeTab).allowed) {
    await rememberTarget(activeTab);
    return activeTab;
  }

  const extensionRoot = browser.runtime.getURL('');

  if (!isExtensionPageUrl(activeTab.url || activeTab.pendingUrl || '', extensionRoot)) {
    return activeTab;
  }

  try {
    const response = await browser.runtime.sendMessage({
      action: GET_TRACKED_TARGET,
      windowId: activeTab.windowId
    });

    return response?.ok ? response.tab || null : null;
  } catch {
    return null;
  }
}

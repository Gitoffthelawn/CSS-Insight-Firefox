const showUpdates = (details) => {
  if (details.reason === 'update') {
    const version = browser.runtime.getManifest().version;
    browser.tabs.create({
      url: browser.runtime.getURL(`update/update.html?version=${version}`)
    });
  }
};

browser.runtime.onInstalled.addListener(showUpdates);

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'close_current_tab') {
    if (sender.tab && sender.tab.id) {
      browser.tabs.remove(sender.tab.id);
    }
  }
});
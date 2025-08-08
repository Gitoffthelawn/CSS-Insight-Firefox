browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'close_current_tab') {
    if (sender.tab && sender.tab.id) {
      browser.tabs.remove(sender.tab.id);
    }
  }
});
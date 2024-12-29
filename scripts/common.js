export function executeScript(tabId, scriptFile, callback, data) {
  browser.scripting.executeScript({
    target: { tabId },
    args: [{ data }],
    func: vars => Object.assign(self, vars),
  }, () => {
    browser.scripting.executeScript({ target: { tabId }, files: [scriptFile] },
      (result) => {
        callback(result);
      });
  });
}
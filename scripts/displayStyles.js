export function displayStyles(styleData) {
  setTimeout(function() {
    document.getElementById('styleData').value = styleData;
    document.getElementById('cssInfo').classList.remove('hidden');
    document.getElementById('moreDetailsBtn').classList.remove('hidden');
  }, 0);

  browser.storage.local.set({ cssData: styleData }, () => {
    console.log('CSS data saved');
  });
}
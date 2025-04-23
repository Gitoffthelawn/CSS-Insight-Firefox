export function displayStyles(styleData) {
  setTimeout(function() {
    let output = document.getElementById('styleData');
    output.innerText = styleData;
    output.scrollTop = 0;
    document.getElementById('cssInfo').classList.remove('hidden');
    document.getElementById('moreDetailsBtn').classList.remove('hidden');
  }, 0);
  
  browser.storage.local.set({ cssData: styleData }, () => {
    console.log('CSS data saved');
  });
}
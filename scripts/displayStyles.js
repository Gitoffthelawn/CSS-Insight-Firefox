export function displayStyles(styleData) {
  const output = document.getElementById('styleData');
  output.textContent = typeof styleData === 'string' ? styleData : String(styleData ?? '');
  output.scrollTop = 0;
  output.removeAttribute('data-highlighted');

  if (globalThis.hljs) {
    globalThis.hljs.highlightElement(output);
  }

  document.getElementById('cssInfo').classList.remove('hidden');
  document.getElementById('moreDetailsBtn').classList.remove('hidden');
}

function applyStyles(cssText) {
  const styleElement = document.createElement('style');

  styleElement.textContent = cssText;

  document.head.appendChild(styleElement);
}

applyStyles(data);
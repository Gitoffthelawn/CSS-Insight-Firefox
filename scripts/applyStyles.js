function applyStyles(cssText) {
  const styleKey = '__CSS_INSIGHT_PREVIEW_STYLE__';
  let styleElement = globalThis[styleKey];

  if (!styleElement?.isConnected) {
    styleElement = document.createElement('style');
    styleElement.dataset.cssInsightPreview = 'true';
    (document.head || document.documentElement).appendChild(styleElement);
    globalThis[styleKey] = styleElement;
  }

  styleElement.textContent = String(cssText || '');
  return true;
}

applyStyles(globalThis.__CSS_INSIGHT_DATA__);

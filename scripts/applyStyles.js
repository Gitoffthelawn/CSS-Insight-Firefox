(() => {
function applyStyles(request) {
  const styleKey = '__CSS_INSIGHT_PREVIEW_STYLES__';
  const targetUtilities = globalThis.__CSS_INSIGHT_TARGET_UTILS__;
  const root = targetUtilities.resolveInspectionRoot(request);

  if (!root) {
    throw new Error(browser.i18n.getMessage('targetunavailable'));
  }

  let previewStyles = globalThis[styleKey];

  if (!(previewStyles instanceof WeakMap)) {
    previewStyles = new WeakMap();
    globalThis[styleKey] = previewStyles;
  }

  let styleElement = previewStyles.get(root);

  if (request?.remove === true) {
    if (!styleElement?.isConnected) return false;

    styleElement.remove();
    previewStyles.delete(root);
    return true;
  }

  if (!styleElement?.isConnected) {
    styleElement = document.createElement('style');
    styleElement.dataset.cssInsightPreview = 'true';
    const container = root === document
      ? document.head || document.documentElement
      : root;
    container.appendChild(styleElement);
    previewStyles.set(root, styleElement);
  }

  styleElement.textContent = String(request?.cssText ?? request ?? '');
  return true;
}

globalThis.__CSS_INSIGHT_OPERATIONS__ = {
  ...globalThis.__CSS_INSIGHT_OPERATIONS__,
  applyStyles
};
})();

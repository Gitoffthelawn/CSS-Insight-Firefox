function parseSelector(selector) {
  return selector.match(/^[a-z0-9-]+|#[\w-]+|\.[\w-]+/g);
}

function getSubSelectors(selector) {
  return parseSelector(selector.toLowerCase().trim());
}

globalThis.__CSS_INSIGHT_STYLE_UTILS__ = {
  ...globalThis.__CSS_INSIGHT_STYLE_UTILS__,
  getSubSelectors
};

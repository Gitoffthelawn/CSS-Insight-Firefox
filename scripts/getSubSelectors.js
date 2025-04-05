function parseSelector(selector) {
  return selector.match(/^[a-z0-9-]+|#[\w-]+|\.[\w-]+/g);
}

function getSubSelectors(selector) {
  return parseSelector(selector.toLowerCase().trim());
}
function getComputedStyles(request) {
  const INVALID_SELECTOR = browser.i18n.getMessage('invalidselector');
  const NOT_FOUND = browser.i18n.getMessage('notfound');
  const TARGET_UNAVAILABLE = browser.i18n.getMessage('targetunavailable');
  const FOUND = browser.i18n.getMessage('found');
  const targetUtilities = globalThis.__CSS_INSIGHT_TARGET_UTILS__;
  const target = targetUtilities.normalizeInspectionTarget(request);
  const root = targetUtilities.resolveInspectionRoot(target);
  const selector = target.selector;
  const safeSelector = String(selector)
    .replace(/\*\//g, '* /')
    .replace(/[\r\n]+/g, ' ')
    .trim();
  let element;

  if (!root) {
    return `/* ${TARGET_UNAVAILABLE} */`;
  }

  try {
    element = root.querySelector(selector);
  } catch {
    return `/* ${INVALID_SELECTOR} "${safeSelector}" */`;
  }

  if (!element) {
    return `/* ${NOT_FOUND} "${safeSelector}" */`;
  }

  const computedStyle = window.getComputedStyle(element);
  const header = `/* ${FOUND} "${safeSelector}": */`;
  const properties = [];

  for (let property of computedStyle) {
    properties.push({
      name: property,
      value: computedStyle.getPropertyValue(property)
    });
  }

  if (request?.structured === true) {
    return {
      type: 'css-insight-computed-styles',
      header,
      properties
    };
  }

  const declarations = properties
    .map(property => `${property.name}: ${property.value};`)
    .join('\n');
  return `${header}\n\n${declarations}`.trim();
}

getComputedStyles(globalThis.__CSS_INSIGHT_DATA__);

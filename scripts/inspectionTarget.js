(() => {
function getTargetUtilities() {
  const escapeIdentifier = globalThis.CSS?.escape || (value =>
    String(value).replace(/[^a-zA-Z0-9_-]/g, character => `\\${character}`));

  function normalizeShadowPath(value) {
    if (!Array.isArray(value)) return [];

    return value
      .filter(selector => typeof selector === 'string' && selector.trim())
      .slice(0, 16)
      .map(selector => selector.trim().slice(0, 2048));
  }

  function normalizeInspectionTarget(value, fallbackSelector = 'body') {
    const selector = typeof value === 'string'
      ? value
      : value?.selector;

    return {
      selector: typeof selector === 'string' && selector.trim()
        ? selector.trim()
        : fallbackSelector,
      shadowPath: normalizeShadowPath(value?.shadowPath)
    };
  }

  function queryCount(root, selector) {
    try {
      return root?.querySelectorAll?.(selector)?.length || 0;
    } catch {
      return 0;
    }
  }

  function createSegment(element, root) {
    const tagName = element.localName || element.tagName?.toLowerCase() || '*';

    if (element.id) {
      const idSelector = `#${escapeIdentifier(element.id)}`;

      if (queryCount(root, idSelector) === 1) {
        return `${tagName}${idSelector}`;
      }
    }

    const classes = Array.from(element.classList || [])
      .filter(Boolean)
      .slice(0, 4)
      .map(className => `.${escapeIdentifier(className)}`)
      .join('');
    let segment = `${tagName}${classes}`;
    const parent = element.parentElement;

    if (parent) {
      const siblings = Array.from(parent.children || [])
        .filter(sibling => sibling.localName === element.localName);

      if (siblings.length > 1) {
        segment += `:nth-of-type(${siblings.indexOf(element) + 1})`;
      }
    }

    return segment;
  }

  function createUniqueSelector(element, root = document) {
    const segments = [];
    let current = element;

    while (current?.nodeType === 1) {
      segments.unshift(createSegment(current, root));
      const selector = segments.join(' > ');

      if (queryCount(root, selector) === 1) {
        return selector;
      }

      current = current.parentElement;
    }

    return segments.join(' > ') || 'body';
  }

  function createInspectionTarget(element) {
    const elementRoot = element?.getRootNode?.() || document;
    const target = {
      selector: createUniqueSelector(element, elementRoot),
      shadowPath: []
    };
    let root = elementRoot;

    while (root?.host) {
      const host = root.host;
      const parentRoot = host.getRootNode?.() || document;
      target.shadowPath.unshift(createUniqueSelector(host, parentRoot));
      root = parentRoot;
    }

    return target;
  }

  function resolveInspectionRoot(value, startRoot = document) {
    const target = normalizeInspectionTarget(value);
    let root = startRoot;

    for (const hostSelector of target.shadowPath) {
      let host;

      try {
        host = root?.querySelector?.(hostSelector);
      } catch {
        return null;
      }

      if (!host?.shadowRoot) return null;
      root = host.shadowRoot;
    }

    return root;
  }

  function formatInspectionTarget(value) {
    const target = normalizeInspectionTarget(value);
    return [...target.shadowPath, target.selector].join(' >>> ');
  }

  return {
    createInspectionTarget,
    createUniqueSelector,
    formatInspectionTarget,
    normalizeInspectionTarget,
    normalizeShadowPath,
    resolveInspectionRoot
  };
}

globalThis.__CSS_INSIGHT_TARGET_UTILS__ = {
  ...globalThis.__CSS_INSIGHT_TARGET_UTILS__,
  ...getTargetUtilities()
};
})();

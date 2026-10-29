export const COMPUTED_STYLES_RESULT = 'css-insight-computed-styles';

export function isComputedStylesResult(value) {
  return value?.type === COMPUTED_STYLES_RESULT &&
    typeof value.header === 'string' &&
    Array.isArray(value.properties);
}

export function filterComputedStyles(result, query = '', noMatchesMessage = '') {
  const normalizedQuery = String(query).trim().toLowerCase();
  const properties = result.properties.filter(property =>
    typeof property?.name === 'string' && typeof property?.value === 'string'
  );
  const matches = normalizedQuery
    ? properties.filter(property =>
      property.name.toLowerCase().includes(normalizedQuery) ||
      property.value.toLowerCase().includes(normalizedQuery)
    )
    : properties;
  const body = matches.length
    ? matches.map(property => `${property.name}: ${property.value};`).join('\n')
    : normalizedQuery
      ? `/* ${String(noMatchesMessage).replace(/\*\//g, '* /')} */`
      : '';

  return {
    matchCount: matches.length,
    text: body ? `${result.header}\n\n${body}`.trim() : result.header.trim(),
    totalCount: properties.length
  };
}

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

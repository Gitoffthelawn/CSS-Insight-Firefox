export const FILTERABLE_STYLES_RESULT = 'css-insight-filterable-styles';

function normalizeEntries(value) {
  if (!Array.isArray(value)) return [];

  return value.filter(entry =>
    typeof entry?.text === 'string' && entry.text.trim()
  );
}

function normalizeNotices(value) {
  if (!Array.isArray(value)) return [];

  return value.filter(notice => typeof notice === 'string' && notice.trim());
}

export function isFilterableStylesResult(value) {
  return value?.type === FILTERABLE_STYLES_RESULT &&
    typeof value.kind === 'string' &&
    normalizeEntries(value.entries).length > 0;
}

export function filterStylesResult(result, query = '', noMatchesMessage = '') {
  const normalizedQuery = String(query).trim().toLowerCase();
  const entries = normalizeEntries(result.entries);
  const notices = normalizeNotices(result.notices);
  const matches = normalizedQuery
    ? entries.filter(entry =>
      String(entry.searchText || entry.text).toLowerCase().includes(normalizedQuery)
    )
    : entries;
  const parts = [];
  const header = typeof result.header === 'string' ? result.header.trim() : '';

  if (header) parts.push(header);
  parts.push(...notices.map(notice => notice.trim()));

  if (matches.length) {
    parts.push(...matches.map(entry => entry.text.trim()));
  } else if (normalizedQuery) {
    parts.push(`/* ${String(noMatchesMessage).replace(/\*\//g, '* /')} */`);
  }

  return {
    matchCount: matches.length,
    text: parts.join('\n\n').trim(),
    totalCount: entries.length
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

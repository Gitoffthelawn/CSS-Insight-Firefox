export function isBlockedURL(tabs) {
  const url = tabs[0]?.url || '';
  
  const blockedPatterns = [
    /^about:/,
    /^moz-extension:\/\//,
    /^https:\/\/addons\.mozilla\.org\//,
  ];
  
  return blockedPatterns.some(pattern => pattern.test(url));
}
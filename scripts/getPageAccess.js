const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'file:']);

const RESTRICTED_MOZILLA_HOSTS = new Set([
  'accounts-static.cdn.mozilla.net',
  'accounts.firefox.com',
  'addons.cdn.mozilla.net',
  'addons.mozilla.org',
  'api.accounts.firefox.com',
  'content.cdn.mozilla.net',
  'discovery.addons.mozilla.org',
  'install.mozilla.org',
  'oauth.accounts.firefox.com',
  'profile.accounts.firefox.com',
  'support.mozilla.org',
  'sync.services.mozilla.com'
]);

export function getPageAccess(tab) {
  if (!tab || !Number.isInteger(tab.id)) {
    return { allowed: false, messageKey: 'pageaccessmissing' };
  }

  const rawUrl = tab.url || tab.pendingUrl || '';

  if (!rawUrl) {
    return { allowed: false, messageKey: 'pageaccessmissing' };
  }

  let url;

  try {
    url = new URL(rawUrl);
  } catch {
    return { allowed: false, messageKey: 'pageaccessprotected' };
  }

  if (RESTRICTED_MOZILLA_HOSTS.has(url.hostname)) {
    return { allowed: false, messageKey: 'pageaccessmozilla' };
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    return { allowed: false, messageKey: 'pageaccessprotected' };
  }

  return { allowed: true, messageKey: null };
}

import { spawnSync } from 'node:child_process';
import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (['.git', 'dist', 'node_modules'].includes(entry.name)) continue;

    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...await walk(absolutePath));
    } else {
      files.push(absolutePath);
    }
  }

  return files;
}

function check(condition, message) {
  if (!condition) errors.push(message);
}

async function exists(relativePath) {
  try {
    await access(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

const allFiles = await walk(root);
const javascriptFiles = allFiles.filter(file => file.endsWith('.js') || file.endsWith('.mjs'));

for (const file of javascriptFiles) {
  const result = spawnSync(process.execPath, ['--check', file], {
    cwd: root,
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    errors.push(`Invalid JavaScript in ${path.relative(root, file)}:\n${result.stderr.trim()}`);
  }
}

const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
const supportedLocales = ['de', 'en', 'es', 'ja', 'pt_BR', 'uk'];
const localeDirectoryEntries = await readdir(path.join(root, '_locales'), { withFileTypes: true });
const localeNames = localeDirectoryEntries
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name)
  .sort();
const localeMessages = Object.fromEntries(await Promise.all(supportedLocales.map(async locale => [
  locale,
  JSON.parse(await readFile(path.join(root, `_locales/${locale}/messages.json`), 'utf8'))
])));
const messages = localeMessages.en;
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const metadata = JSON.parse(await readFile(path.join(root, 'metadata.json'), 'utf8'));
const readme = await readFile(path.join(root, 'README.md'), 'utf8');
const buildSource = await readFile(path.join(root, 'tools/build.mjs'), 'utf8');

check(manifest.manifest_version === 3, 'manifest_version must remain 3 for the Firefox build.');
check(manifest.default_locale === 'en', 'The default locale must remain English.');
check(JSON.stringify(localeNames) === JSON.stringify(supportedLocales),
  `Locale directories must be exactly: ${supportedLocales.join(', ')}.`);
check(manifest.version === packageJson.version, 'manifest.json and package.json versions differ.');
check(!packageJson.buildLabel,
  'Release packages must not carry an experimental build label.');
check(/await createZip\(sourceFiles, sourceZip\);/.test(buildSource),
  'The source archive must place project files directly at the ZIP root.');
check(readme.includes(`v${manifest.version}`), 'README badges do not contain the manifest version.');
check(JSON.stringify(manifest.permissions) ===
  JSON.stringify(['storage', 'tabs', 'activeTab', 'scripting']),
  'Firefox permissions must preserve the mobile tab-based interaction model.');
check(JSON.stringify(manifest.host_permissions) === JSON.stringify(['<all_urls>']),
  'Firefox host permissions must keep the picker available across mobile tabs.');
check(Array.isArray(manifest.content_scripts) && manifest.content_scripts.length === 1,
  'The Firefox picker controller must be declared as a content script.');
check(manifest.content_scripts?.[0]?.matches?.includes('<all_urls>'),
  'The Firefox picker must be available on supported pages before the popup opens.');
check(manifest.content_scripts?.[0]?.all_frames === true,
  'The Firefox picker must be injected into matching iframe documents.');
check(manifest.content_scripts?.[0]?.match_about_blank === true &&
  manifest.content_scripts?.[0]?.match_origin_as_fallback === true,
  'The Firefox picker must cover related blank, data and blob frames.');
check(!('web_accessible_resources' in manifest), 'Internal update resources must not be web-accessible.');
check(Array.isArray(manifest.background?.scripts), 'Firefox must use background scripts.');
check(!('service_worker' in (manifest.background || {})), 'Firefox must not use a Chromium service worker.');
check(manifest.background?.persistent === false, 'Firefox background scripts must be non-persistent.');
check(manifest.browser_specific_settings?.gecko?.id ===
  '{3cf44542-4a82-4868-a366-be8126b42458}', 'The AMO extension ID changed.');
check(!('id' in (manifest.browser_specific_settings?.gecko_android || {})),
  'gecko_android does not support a separate extension ID.');
check(Boolean(metadata.summary?.['en-US']), 'AMO metadata must include an English summary.');
check(Array.isArray(metadata.categories?.firefox) &&
  metadata.categories.firefox.includes('web-development'),
  'AMO metadata must include the Firefox web-development category.');
check(metadata.version?.license === 'MIT', 'AMO metadata must declare the MIT license.');
for (const relativePath of [
  manifest.action?.default_popup,
  ...(manifest.background?.scripts || []),
  ...Object.values(manifest.icons || {})
].filter(Boolean)) {
  check(await exists(relativePath), `Manifest resource is missing: ${relativePath}`);
}

for (const forbiddenFile of [
  '1.html',
  '1.sql',
  'scripts/getSubSelectors.js',
  'scripts/formatTagName.js',
  'scripts/isBlockedURL.js'
]) {
  check(!await exists(forbiddenFile), `Accidental file is still present: ${forbiddenFile}`);
}

const usedMessageKeys = new Set();

for (const file of allFiles.filter(file => file.endsWith('.html') || file.endsWith('.js'))) {
  const source = await readFile(file, 'utf8');

  for (const match of source.matchAll(/data-i18n(?:-placeholder|-aria-label)?=["']([^"']+)["']/g)) {
    usedMessageKeys.add(match[1]);
  }

  for (const match of source.matchAll(/(?:\bt|\.getMessage)\(\s*["']([^"']+)["']/g)) {
    usedMessageKeys.add(match[1]);
  }
}

for (const match of JSON.stringify(manifest).matchAll(/__MSG_([^_]+)__/g)) {
  usedMessageKeys.add(match[1]);
}

for (const key of usedMessageKeys) {
  check(Boolean(messages[key]?.message), `Missing English localization key: ${key}`);
}

const englishMessageKeys = Object.keys(messages).sort();

for (const locale of supportedLocales) {
  const localizedMessages = localeMessages[locale];
  const localizedKeys = Object.keys(localizedMessages).sort();

  check(JSON.stringify(localizedKeys) === JSON.stringify(englishMessageKeys),
    `${locale} localization keys differ from English.`);

  for (const key of englishMessageKeys) {
    check(typeof localizedMessages[key]?.message === 'string' &&
      localizedMessages[key].message.length > 0,
    `Missing ${locale} localization message: ${key}`);
  }

  check([...localizedMessages.description.message].length <= 132,
    `${locale} manifest description exceeds 132 characters.`);
}

const firstPartyTextFiles = allFiles.filter(file => {
  const relative = path.relative(root, file);
  return /\.(?:js|mjs|json|html|css|md)$/.test(file) &&
    !relative.startsWith(`scripts${path.sep}highlight.min.js`) &&
    !relative.startsWith(`styles${path.sep}atom-one-light.min.css`) &&
    !relative.startsWith(`third_party${path.sep}`);
});

for (const file of firstPartyTextFiles) {
  const source = await readFile(file, 'utf8');
  check(!/[\u2013\u2014]/.test(source), `Long dash found in ${path.relative(root, file)}.`);
}

const pickerSource = await readFile(path.join(root, 'scripts/getTagName.js'), 'utf8');
const pickerControllerVersions = [...pickerSource.matchAll(
  /(?:existingController\?\.version ===|version:)\s*['"]([^'"]+)['"]/g
)].map(match => match[1]);

check(pickerControllerVersions.length === 2 &&
  pickerControllerVersions.every(version => version === manifest.version),
  'The picker controller version must match manifest.json.');
check(!/javascript\s*:/i.test(pickerSource), 'Picker must not create javascript: URLs.');
check(!/\.href\s*=/.test(pickerSource), 'Picker must not rewrite link destinations.');
check(!/storage\.local/.test(pickerSource),
  'Content tabs must submit selections to the background instead of racing on storage.');
check(/ACTIONS\.selectElement/.test(pickerSource),
  'The content picker must submit a tokenized selection to the background.');
check(/browser\.runtime\.onMessage/.test(pickerSource), 'Picker must use the Firefox browser API.');
const popupSource = await readFile(path.join(root, 'popup.js'), 'utf8');
check(!/window\.close\s*\(/.test(popupSource),
  'The popup must not close its own tab after starting the picker.');
check(!/activateTab\s*\(/.test(popupSource),
  'The popup must not force one target tab to become active.');
check(/cssInsight:armPicker/.test(popupSource) && /cssInsight:cancelPicker/.test(popupSource),
  'The popup must control the window-scoped picker session.');
const backgroundSource = await readFile(path.join(root, 'scripts/service_worker.js'), 'utf8');
check(/cssInsightPickerSessions/.test(backgroundSource),
  'The background must persist window-scoped picker sessions.');
check(/broadcastPicker/.test(backgroundSource) && /acceptSelection/.test(backgroundSource),
  'The background must arm all eligible tabs and accept only the winning selection.');
check(/RESTRICTED_MOZILLA_HOSTS/.test(backgroundSource),
  'The background must preserve Firefox restricted-host handling.');

for (const file of javascriptFiles.filter(file => {
  const relative = path.relative(root, file);
  return !relative.startsWith(`tests${path.sep}`) &&
    !relative.startsWith(`tools${path.sep}`) &&
    relative !== `scripts${path.sep}highlight.min.js`;
})) {
  const source = await readFile(file, 'utf8');
  check(!/\bchrome\./.test(source),
    `Chromium API usage found in Firefox runtime: ${path.relative(root, file)}.`);
}

if (errors.length) {
  console.error(errors.map(error => `- ${error}`).join('\n'));
  process.exit(1);
}

console.log(`Static checks passed: ${javascriptFiles.length} JavaScript files, ${usedMessageKeys.size} localization keys across ${supportedLocales.length} locales.`);

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(location.search);
  const version = params.get('version') || '-';
  document.getElementById('version').textContent = version;

  const features = [
    '🌐 Use the interface in five new languages.',
    '🧩 See localized picker, status and CSS result messages.',
    '🛡️ Keep browser-specific protected-page guidance.',
    '✅ Validate every locale against the complete English message set.'
  ];

  const list = document.getElementById('features');

  for (const item of features) {
    const listItem = document.createElement('li');
    listItem.textContent = item;
    list.append(listItem);
  }

  document.getElementById('close-btn').addEventListener('click', () => {
    browser.runtime.sendMessage({ type: 'close_current_tab' })
      .catch(() => window.close());
  });
});

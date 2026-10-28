document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(location.search);
  const version = params.get('version') || '-';
  document.getElementById('version').textContent = version;

  const features = [
    '🧩 Inspect matching rules inside modern CSS at-rules and native nesting.',
    '📚 Include constructed stylesheets adopted by the document.',
    '🎯 Match complete selector branches without unrelated comma-list results.',
    '✅ Get a clear result when a CSS selector is invalid.'
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

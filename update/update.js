document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(location.search);
  const version = params.get('version') || '-';
  document.getElementById('version').textContent = version;

  const features = [
    '📱 Start the picker, then choose any supported page in the same window.',
    '🎯 The first selection wins and stops the picker in every tab.',
    '🧭 Silent or inactive tabs no longer block the next picker session.',
    '⏱️ Picker sessions can be cancelled and expire after two minutes.'
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

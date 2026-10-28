document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(location.search);
  const version = params.get('version') || '-';
  document.getElementById('version').textContent = version;

  const features = [
    '🖼️ Pick and inspect elements inside matching iframe documents.',
    '🧩 Inspect elements and styles inside nested open shadow roots.',
    '🎯 Keep later CSS operations attached to the frame and root you selected.',
    '🎨 Apply independent preview rules to a document or open shadow root.'
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

function showModalWithCSSData(cssData) {
  const CLOSE = browser.i18n.getMessage('close');

  const modal = document.createElement('div');
  modal.style.position = 'fixed';
  modal.style.top = '0';
  modal.style.left = '0';
  modal.style.width = '100%';
  modal.style.height = '100dvh';
  modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  modal.style.display = 'flex';
  modal.style.justifyContent = 'center';
  modal.style.alignItems = 'center';
  modal.style.zIndex = '99999';

  const modalContent = document.createElement('div');
  modalContent.style.backgroundColor = 'white';
  modalContent.style.padding = '20px';
  modalContent.style.borderRadius = '5px';
  modalContent.style.width = '76%';
  modalContent.style.maxWidth = '400px';
  modalContent.style.height = '80%';
  modalContent.style.maxHeight = '900px';
  modalContent.style.overflowY = 'auto';

  const textArea = document.createElement('textarea');
  textArea.style.color = 'rgb(255, 0, 255)';
  textArea.style.textShadow = 'rgba(0, 255, 0, 0.25) 2px 2px 4px';
  textArea.style.width = '98%';
  textArea.style.maxWidth = '380px';
  textArea.style.height = '89%';
  textArea.style.maxHeight = '800px';
  textArea.textContent = cssData;

  const closeButton = document.createElement('button');
  closeButton.textContent = CLOSE;
  closeButton.style.marginTop = '10px';
  closeButton.style.padding = '10px';
  closeButton.style.backgroundColor = '#007bff';
  closeButton.style.color = 'white';
  closeButton.style.border = 'none';
  closeButton.style.cursor = 'pointer';

  closeButton.addEventListener('click', () => {
    modal.remove();
  });

  modalContent.appendChild(textArea);
  modalContent.appendChild(closeButton);
  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  return null;
}

showModalWithCSSData(data);

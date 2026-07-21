export function createSettingsPanel(container) {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: absolute; inset: 0; display: none; flex-direction: column;
    align-items: center; justify-content: center; color: #fff;
    font-family: sans-serif; background: rgba(0,0,0,0.7); z-index: 25;
  `;
  container.appendChild(overlay);

  function show(sensitivity, onChange, onClose) {
    overlay.innerHTML = '';

    const title = document.createElement('h2');
    title.textContent = '설정';
    overlay.appendChild(title);

    const label = document.createElement('p');
    label.textContent = `마우스 민감도: ${sensitivity.toFixed(1)}x`;
    overlay.appendChild(label);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0.5';
    slider.max = '2.0';
    slider.step = '0.1';
    slider.value = String(sensitivity);
    slider.addEventListener('input', () => {
      const value = parseFloat(slider.value);
      label.textContent = `마우스 민감도: ${value.toFixed(1)}x`;
      onChange(value);
    });
    overlay.appendChild(slider);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '닫기';
    closeBtn.style.cssText = `
      margin-top: 16px; padding: 10px 24px; font-size: 18px; cursor: pointer;
      border: none; border-radius: 6px; background: #f0a500; color: #1a1a2e;
    `;
    closeBtn.addEventListener('click', onClose);
    overlay.appendChild(closeBtn);

    overlay.style.display = 'flex';
  }

  function hide() {
    overlay.style.display = 'none';
  }

  return { show, hide };
}

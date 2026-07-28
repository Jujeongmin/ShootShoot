import { scrim, panel, button, iconButton, title, num } from './kit.js';

export function createSettingsPanel(container) {
  const overlay = scrim();
  overlay.style.zIndex = '25';
  container.appendChild(overlay);

  function show(sensitivity, onChange, onClose) {
    overlay.innerHTML = '';

    const box = panel();
    box.style.cssText = 'position: relative; text-align: center; min-width: 300px;';

    const closeBtn = iconButton('cross', '닫기', onClose, 36);
    closeBtn.style.cssText += 'position: absolute; top: -14px; right: -14px;';
    box.appendChild(closeBtn);

    box.appendChild(title('설정'));

    const label = document.createElement('div');
    label.style.cssText = 'color: #4a4a5e; font-size: 15px; margin: 10px 0 6px;';
    label.appendChild(document.createTextNode('마우스 민감도 '));
    const value = num(`${sensitivity.toFixed(1)}x`);
    label.appendChild(value);
    box.appendChild(label);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'k-slider';
    slider.min = '0.5';
    slider.max = '2.0';
    slider.step = '0.1';
    slider.value = String(sensitivity);
    slider.addEventListener('input', () => {
      const next = parseFloat(slider.value);
      value.textContent = `${next.toFixed(1)}x`;
      onChange(next);
    });
    box.appendChild(slider);

    const doneBtn = button('닫기', onClose, 'ghost');
    doneBtn.style.cssText += 'display: block; margin: 16px auto 0;';
    box.appendChild(doneBtn);

    overlay.appendChild(box);
    overlay.style.display = 'flex';
  }

  function hide() {
    overlay.style.display = 'none';
  }

  return { show, hide };
}

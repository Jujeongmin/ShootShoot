import { scrim, panel, button, iconButton, title, num, TOKENS } from './kit';

export function createSettingsPanel(container: HTMLElement) {
  const overlay = scrim();
  overlay.style.zIndex = '25';
  container.appendChild(overlay);

  // onExit 는 플레이 중에 열렸을 때만 넘어온다. 메뉴에서 연 설정에
  // '메뉴로' 가 있으면 말이 안 된다.
  // onReplayTutorial 은 메뉴에서도 넘어온다. 조작 설명이라 '메뉴로'와 달리
  // 어디서 열었든 다시 볼 수 있어야 한다.
  function show(
    sensitivity: number,
    onChange: (value: number) => void,
    onClose: () => void,
    onExit?: () => void,
    onReplayTutorial?: () => void,
  ) {
    overlay.innerHTML = '';

    const box = panel();
    box.classList.add('responsive-panel', 'settings-panel');
    box.style.cssText = 'position: relative; text-align: center; min-width: 260px;';

    const closeBtn = iconButton('cross', 'Close', onClose, 36);
    closeBtn.style.cssText += 'position: absolute; top: -14px; right: -14px;';
    box.appendChild(closeBtn);

    box.appendChild(title('Settings'));

    const label = document.createElement('div');
    label.style.cssText = `color: ${TOKENS.inkSoft}; font-size: 15px; margin: 6px 0 4px;`;
    label.appendChild(document.createTextNode('Mouse sensitivity '));
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

    const actions = document.createElement('div');
    actions.style.cssText = 'display: flex; justify-content: center; gap: 12px; margin-top: 10px;';
    if (typeof onReplayTutorial === 'function') {
      actions.appendChild(button('Replay tutorial', onReplayTutorial, 'ghost'));
    }
    if (typeof onExit === 'function') {
      actions.appendChild(button('Menu', onExit, 'ghost'));
    }
    actions.appendChild(button('Close', onClose, 'ghost'));
    box.appendChild(actions);

    overlay.appendChild(box);
    overlay.style.display = 'flex';
  }

  function hide() {
    overlay.style.display = 'none';
  }

  return { show, hide };
}

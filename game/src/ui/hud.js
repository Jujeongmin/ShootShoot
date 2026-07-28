import { badge, TOKENS } from './kit.js';

export function createHud(container) {
  const el = document.createElement('div');
  el.style.cssText = `
    position: absolute; top: 12px; left: 12px;
    display: flex; flex-direction: column; align-items: flex-start; gap: 6px;
    pointer-events: none; z-index: 10;
  `;
  container.appendChild(el);

  // render는 매 프레임 불릴 수 있다. 배지를 한 번만 만들고 숫자만 갈아 끼운다.
  function row(labelText) {
    const wrapper = badge('0');
    const label = document.createElement('span');
    label.textContent = labelText;
    label.style.cssText = 'font-size: 13px; color: #4a4a5e; margin-right: 2px;';
    wrapper.insertBefore(label, wrapper.firstChild);
    el.appendChild(wrapper);
    return wrapper.querySelector('.k-num');
  }

  const scoreValue = row('점수');
  const streakValue = row('연속');
  const roundValue = row('라운드');

  function render({ score, streak, round }) {
    scoreValue.textContent = score.toLocaleString();
    streakValue.textContent = String(streak);
    roundValue.textContent = String(round);
  }

  function showScorePopup(text, clientX, clientY) {
    const popup = document.createElement('div');
    popup.textContent = text;
    popup.style.cssText = `
      position: absolute; left: ${clientX}px; top: ${clientY}px; transform: translate(-50%, -50%);
      color: ${TOKENS.face}; font-family: 'Kenney Future Narrow', sans-serif; font-weight: bold;
      font-size: 24px; pointer-events: none;
      text-shadow: 0 2px 0 ${TOKENS.deep}, 0 1px 4px rgba(0,0,0,0.8);
      transition: transform 0.6s ease-out, opacity 0.6s ease-out; z-index: 15;
    `;
    container.appendChild(popup);
    requestAnimationFrame(() => {
      popup.style.transform = 'translate(-50%, -120%)';
      popup.style.opacity = '0';
    });
    setTimeout(() => popup.remove(), 650);
  }

  function dispose() {
    el.remove();
  }

  return { render, showScorePopup, dispose };
}

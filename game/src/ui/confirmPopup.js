import { scrim, panel, button, title, TOKENS } from './kit.js';

// 되돌릴 수 없는 동작 앞에 세우는 얇은 모달. 무엇을 확인하는지는 부르는 쪽이
// 문구로 넘긴다 — 이 모듈은 새 게임을 모른다.
export function createConfirmPopup(container) {
  const overlay = scrim();
  // 메뉴(20)와 설정·상점(25) 위에 떠야 한다.
  overlay.style.zIndex = '30';
  container.appendChild(overlay);

  function show({ heading, message, confirmLabel }, onConfirm, onCancel) {
    overlay.innerHTML = '';

    const box = panel();
    box.style.cssText = 'text-align: center; max-width: 360px;';
    box.appendChild(title(heading));

    const text = document.createElement('div');
    text.style.cssText = `color: ${TOKENS.inkSoft}; font-size: 15px; margin: 10px 0 6px;`;
    text.textContent = message;
    box.appendChild(text);

    const actions = document.createElement('div');
    actions.style.cssText = 'display: flex; justify-content: center; gap: 12px; margin-top: 16px;';
    actions.appendChild(button(confirmLabel, onConfirm, 'primary'));
    actions.appendChild(button('취소', onCancel, 'ghost'));
    box.appendChild(actions);

    overlay.appendChild(box);
    overlay.style.display = 'flex';
  }

  function hide() {
    overlay.style.display = 'none';
  }

  return { show, hide };
}

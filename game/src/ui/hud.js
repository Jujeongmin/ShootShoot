import { TOKENS } from './kit.js';

// game.js 의 round 는 1 에서 시작하고 startGame 이 beginRound(1) 로 되돌린다.
// render 는 플레이 중에만 불리므로, 메뉴에서 보일 값은 이 초기값이다.
const INITIAL_ROUND = '1';

export function createHud(container) {
  const el = document.createElement('div');
  el.style.cssText = `
    position: absolute; top: 14px; left: 50%; transform: translateX(-50%);
    pointer-events: none; z-index: 21;
  `;
  container.appendChild(el);

  // 감싸는 프레임 없이 라벨과 숫자만 놓는다. 배경이 3D 장면이라 외곽선 그림자로 띄운다.
  const roundLabel = document.createElement('div');
  roundLabel.className = 'k-round-label';
  roundLabel.textContent = '라운드';
  el.appendChild(roundLabel);

  const roundValue = document.createElement('div');
  roundValue.className = 'k-num k-round';
  roundValue.textContent = INITIAL_ROUND;
  el.appendChild(roundValue);

  // score 와 streak 은 더 이상 표시하지 않는다. game.js 가 계속 보내오지만
  // 화면에 남는 건 라운드뿐이다. 점수는 사격할 때 뜨는 팝업으로만 보인다.
  function render({ round }) {
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

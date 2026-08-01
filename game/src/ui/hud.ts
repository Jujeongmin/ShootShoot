import type { PopupTone } from './scorePopupTone';

// game.ts 의 round 는 1 에서 시작하고 startGame 이 beginRound(1) 로 되돌린다.
// render 는 플레이 중에만 불리므로, 메뉴에서 보일 값은 이 초기값이다.
const INITIAL_ROUND = '1';

export function createHud(container: HTMLElement) {
  const el = document.createElement('div');
  el.style.cssText = `
    position: absolute; top: 14px; left: 50%; transform: translateX(-50%);
    pointer-events: none; z-index: 21; text-align: center;
  `;
  container.appendChild(el);

  // 감싸는 프레임 없이 라벨과 숫자만 놓는다. 배경이 3D 장면이라 외곽선 그림자로 띄운다.
  const roundLabel = document.createElement('div');
  roundLabel.className = 'k-round-label';
  roundLabel.textContent = '라운드';
  el.appendChild(roundLabel);

  const roundValue = document.createElement('div');
  roundValue.className = 'k-num k-round k-bracket';
  roundValue.textContent = INITIAL_ROUND;
  el.appendChild(roundValue);

  // 나가는 길이 P -> 설정 -> '메뉴로' 하나뿐이라, 첫 판을 하는 사람은 판을 끝낼
  // 방법을 찾지 못한다. 그래서 안내를 화면에 계속 띄운다.
  const hint = document.createElement('div');
  hint.style.cssText = `
    position: absolute; top: 14px; right: 18px;
    pointer-events: none; z-index: 21; display: none;
  `;
  container.appendChild(hint);

  const hintKey = document.createElement('div');
  hintKey.className = 'k-hint-key';
  hintKey.textContent = 'P';
  hint.appendChild(hintKey);

  const hintText = document.createElement('div');
  hintText.className = 'k-hint-text';
  hintText.textContent = '메뉴로 나가기';
  hint.appendChild(hintText);

  // score 와 streak 은 더 이상 표시하지 않아서 받지도 않는다. 화면에 남는 건
  // 라운드뿐이고, 점수는 사격할 때 뜨는 팝업으로만 보인다.
  function render({ round }: { round: number }) {
    roundValue.textContent = String(round);
  }

  // 매 프레임 불린다. 대입만 하고 아무 일도 하지 않는다.
  function setHintVisible(visible: boolean) {
    hint.style.display = visible ? 'block' : 'none';
  }

  // 톤별로 더 붙는 클래스. 헤드샷은 브래킷을 두르고 관통은 아래 눈금 줄을 쓴다 —
  // 같은 장식을 두 뜻으로 쓰지 않는다.
  const TONE_CLASS: Record<PopupTone, string> = {
    normal: '',
    head: 'k-score-popup--head k-bracket',
    combo: 'k-score-popup--combo',
  };

  function showScorePopup(text: string, clientX: number, clientY: number, tone: PopupTone = 'normal') {
    const popup = document.createElement('div');
    popup.textContent = text;
    popup.className = `k-score-popup ${TONE_CLASS[tone]}`.trim();
    // 맞은 자리는 매번 다르므로 위치만 인라인이다. 나머지 모양은 전부 CSS다.
    popup.style.left = `${clientX}px`;
    popup.style.top = `${clientY}px`;
    container.appendChild(popup);
    requestAnimationFrame(() => {
      popup.classList.add('k-score-popup--rise');
    });
    setTimeout(() => popup.remove(), 650);
  }

  function dispose() {
    el.remove();
    hint.remove();
  }

  return { render, setHintVisible, showScorePopup, dispose };
}

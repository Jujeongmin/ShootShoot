import type { PopupTone } from './scorePopupTone';

// game.ts 의 startGame 은 이제 라운드 번호를 인자로 받아 beginRound(round) 로
// 넘긴다(항상 1은 아니다). render 도 플레이 중이 아니어도 불릴 수 있다 —
// returnToMenu 는 round 를 되돌리지도, 다시 그리지도 않으므로 메뉴에는 마지막으로
// 플레이한 라운드 값이 그대로 남는다. 이 초기값은 페이지를 처음 열었을 때만 보인다.
const INITIAL_ROUND = '1';

export function createHud(container: HTMLElement, onSettings: () => void) {
  const el = document.createElement('div');
  el.style.cssText = `
    position: absolute; top: 14px; left: 50%; transform: translateX(-50%);
    pointer-events: none; z-index: 21; text-align: center;
  `;
  container.appendChild(el);

  // 감싸는 프레임 없이 라벨과 숫자만 놓는다. 배경이 3D 장면이라 외곽선 그림자로 띄운다.
  const roundLabel = document.createElement('div');
  roundLabel.className = 'k-round-label';
  // 글자를 span으로 감싸는 이유는 theme.css 의 .k-round-label > span 주석에 있다 —
  // 요약하면 flex 항목의 바깥 폭에서 글꼴이 만든 죽은 폭을 빼야 좌우 막대가 대칭이 된다.
  // 익명 텍스트 노드에는 스타일을 못 걸어서 요소가 하나 필요하다.
  const roundLabelText = document.createElement('span');
  roundLabelText.textContent = 'ROUND';
  roundLabel.appendChild(roundLabelText);
  el.appendChild(roundLabel);

  const roundValue = document.createElement('div');
  roundValue.className = 'k-num k-round k-bracket';
  roundValue.textContent = INITIAL_ROUND;
  el.appendChild(roundValue);

  // 나가는 길이 P -> 설정 -> '메뉴로' 하나뿐이라, 첫 판을 하는 사람은 판을 끝낼
  // 방법을 찾지 못한다. 그래서 안내를 화면에 계속 띄운다.
  const hint = document.createElement('div');
  hint.className = 'game-controls';
  hint.style.cssText = `
    position: absolute; top: 14px; right: 18px;
    pointer-events: none; z-index: 21; display: none;
  `;
  container.appendChild(hint);

  const settingsButton = document.createElement('button');
  settingsButton.type = 'button';
  settingsButton.className = 'k-icon-btn game-settings-btn';
  settingsButton.setAttribute('aria-label', 'Settings');
  settingsButton.innerHTML = '<img src="/icons/white/gear.png" alt="">';
  settingsButton.addEventListener('click', onSettings);
  hint.appendChild(settingsButton);

  const hintKey = document.createElement('div');
  hintKey.className = 'k-hint-key game-settings-key';
  hintKey.textContent = 'P';
  hint.appendChild(hintKey);

  const hintText = document.createElement('div');
  hintText.className = 'k-hint-text game-settings-key';
  hintText.textContent = 'exit to menu';
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

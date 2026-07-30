// 단계 이름을 문구로 바꾸는 곳. 상태 기계는 문구를 모른다.
const STEP_TEXT = {
  aim: '마우스를 누른 채로 조준하세요',
  fire: '손을 떼면 발사됩니다',
  reload: '장전 중에는 조준할 수 없습니다',
  clear: '원숭이를 모두 잡으면 다음 라운드로',
};

export function createTutorialPrompt(container) {
  const el = document.createElement('div');
  el.className = 'k-tutorial';
  el.style.display = 'none';
  container.appendChild(el);

  let shownStep = null;

  return {
    // 매 프레임 불린다. 단계가 그대로면 DOM 을 건드리지 않는다.
    show(step) {
      if (step === shownStep) return;
      shownStep = step;
      const text = STEP_TEXT[step];
      if (text === undefined) {
        el.style.display = 'none';
        return;
      }
      el.textContent = text;
      el.style.display = 'block';
    },
    dispose() {
      el.remove();
    },
  };
}

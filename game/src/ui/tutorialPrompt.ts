// 단계 이름을 문구로 바꾸는 곳. 상태 기계는 문구를 모른다.
// tutorialState.ts의 Step에는 문구가 없는 'done'도 있다 — 그 값이 오면 아래
// 인덱싱이 undefined를 내어 프롬프트가 숨는다. 그래서 여기 키를 그 타입과
// 맞추지 않고 string으로 넓게 받는다.
const STEP_TEXT: Record<string, string> = {
  aim: 'Hold the mouse button to aim',
  fire: 'Release to fire',
  reload: 'You cannot aim while reloading',
  clear: 'Clear every monkey to advance',
};

export function createTutorialPrompt(container: HTMLElement) {
  const el = document.createElement('div');
  el.className = 'k-tutorial';
  el.style.display = 'none';
  container.appendChild(el);

  let shownStep: string | null = null;

  return {
    // 매 프레임 불린다. 단계가 그대로면 DOM 을 건드리지 않는다.
    show(step: string) {
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

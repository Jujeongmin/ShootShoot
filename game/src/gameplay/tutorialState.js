// 튜토리얼 단계와 전이만 갖는다. 문구는 UI(tutorialPrompt.js)가 갖는다 — 문구를
// 고칠 때 이 모듈의 테스트가 깨지면 안 된다.
//
// 각 단계는 자기가 기다리는 이벤트 하나에만 반응한다. 그래서 조준을 여러 번
// 누르거나 엉뚱한 순서로 이벤트가 와도 단계가 건너뛰어지지 않는다.
const NEXT_STEP = {
  aim: { event: 'aimStarted', next: 'fire' },
  fire: { event: 'shotFired', next: 'reload' },
  reload: { event: 'reloadFinished', next: 'clear' },
  clear: { event: 'roundCleared', next: 'done' },
};

const FIRST_STEP = 'aim';
const DONE_STEP = 'done';

export function createTutorialState() {
  let step = FIRST_STEP;

  return {
    current() {
      return step;
    },
    handle(event) {
      const transition = NEXT_STEP[step];
      if (!transition) return;
      if (transition.event !== event) return;
      step = transition.next;
    },
    isDone() {
      return step === DONE_STEP;
    },
    reset() {
      step = FIRST_STEP;
    },
  };
}

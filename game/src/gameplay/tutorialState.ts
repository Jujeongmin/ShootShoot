// 튜토리얼 단계와 전이만 갖는다. 문구는 UI(tutorialPrompt.js)가 갖는다 — 문구를
// 고칠 때 이 모듈의 테스트가 깨지면 안 된다.
//
// 각 단계는 자기가 기다리는 이벤트 하나에만 반응한다. 그래서 조준을 여러 번
// 누르거나 엉뚱한 순서로 이벤트가 와도 단계가 건너뛰어지지 않는다.
type Step = 'aim' | 'fire' | 'reload' | 'clear' | 'done';

const NEXT_STEP: Partial<Record<Step, { event: string; next: Step }>> = {
  aim: { event: 'aimStarted', next: 'fire' },
  fire: { event: 'shotFired', next: 'reload' },
  reload: { event: 'reloadFinished', next: 'clear' },
  clear: { event: 'roundCleared', next: 'done' },
};

const FIRST_STEP: Step = 'aim';
const DONE_STEP: Step = 'done';

export function createTutorialState() {
  let step: Step = FIRST_STEP;

  return {
    current() {
      return step;
    },
    handle(event: string) {
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
    // 이미 튜토리얼을 본 플레이어라고 저장소(store)가 말해줄 때 쓴다. 그 경우
    // aim → fire → reload → clear 네 개의 가짜 이벤트를 순서대로 호출해 done
    // 까지 흉내 내는 건 실제로 일어나지 않은 일을 일어났다고 거짓말하는
    // 셈이다. 그래서 이벤트를 재생하지 않고 곧장 done 으로 건너뛴다.
    finish() {
      step = DONE_STEP;
    },
  };
}

// 장전 남은 시간만 들고 있는다. 뷰모델이 아니라 여기 두는 이유는,
// 바주카 마지막 발을 쏘면 뷰모델이 교체되면서 장전 상태가 사라지기 때문이다.
export function createReloadState(seconds) {
  let remainingSeconds = 0;

  return {
    start() {
      remainingSeconds = seconds;
    },
    // 프레임이 길어도 0 아래로 내려가지 않는다.
    tick(dt) {
      remainingSeconds = Math.max(0, remainingSeconds - dt);
    },
    isReloading() {
      return remainingSeconds > 0;
    },
    remaining() {
      return remainingSeconds;
    },
    reset() {
      remainingSeconds = 0;
    },
  };
}

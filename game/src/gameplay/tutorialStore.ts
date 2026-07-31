// 튜토리얼을 봤는지만 기억한다. 판 안의 진행 단계는 tutorialState.js 가 갖는다 —
// 수명이 달라서 한 모듈에 두면 '다시 보기'가 무엇을 지워야 하는지 흐려진다.
const DONE_VALUE = '1';

export function createTutorialStore(storage: Storage, key: string) {
  return {
    isDone() {
      return storage.getItem(key) === DONE_VALUE;
    },
    markDone() {
      storage.setItem(key, DONE_VALUE);
    },
    clear() {
      storage.removeItem(key);
    },
  };
}

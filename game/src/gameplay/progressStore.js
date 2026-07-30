// 도달한 라운드를 판을 넘어 남긴다. 최고점수 스토어와 같은 "더 큰 값만 쓴다"
// 규칙이라, 라운드 선택으로 낮은 라운드를 다시 깨도 도달 라운드가 깎이지 않는다.
const FIRST_ROUND = 1;

export function createProgressStore(storage, key) {
  function read() {
    const raw = storage.getItem(key);
    if (raw === null) return FIRST_ROUND;
    const value = Number.parseInt(raw, 10);
    if (Number.isNaN(value) || value < FIRST_ROUND) return FIRST_ROUND;
    return value;
  }

  return {
    getReachedRound() {
      return read();
    },
    // 깬 라운드를 넣으면 그 다음 라운드가 도달 라운드가 된다.
    submitCleared(round) {
      const next = Math.max(read(), round + 1);
      storage.setItem(key, String(next));
      return next;
    },
    clear() {
      storage.removeItem(key);
    },
  };
}

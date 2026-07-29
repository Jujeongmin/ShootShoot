// 하늘 장식이 움직이는 데 필요한 계산만 모아 둔다. three.js 가 없으므로
// 프레임 루프 밖에서 그대로 테스트된다.

// x 를 dx 만큼 밀되 범위를 벗어나면 반대쪽 끝으로 넘긴다. 한 프레임이 아무리
// 길어도 범위 안에 떨어지도록 조건문 대신 나머지 연산을 쓴다.
export function driftWrapped(x, dx, minX, maxX) {
  const span = maxX - minX;
  const offset = x + dx - minX;
  return minX + ((offset % span) + span) % span;
}

// 0 에서 1 사이를 도는 진행도. 1 을 넘으면 넘어간 만큼을 남긴다 — 0 으로 대입하면
// 프레임마다 남는 조각이 버려져 무리가 조금씩 앞당겨진다.
export function flightProgress(t, dt, durationSeconds) {
  if (durationSeconds <= 0) return 0;
  return (t + dt / durationSeconds) % 1;
}

// 판마다 하늘 배치가 달라지면 육안으로 회귀를 잡을 수 없다. 고정 시드에서
// 같은 수열을 내는 LCG 하나면 배치용으로 충분하다.
export function createSeededRandom(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

// 원숭이의 좌우 순찰 곡선. THREE에 의존하지 않는 순수 모듈이라
// 궤적·방향 전환·걸음 진행을 테스트로 못 박을 수 있다.
//
// 곡선 자체는 예전에 monkey.js의 updateIdle이 인라인으로 갖고 있던 것과 같다.
// laneLayout.js가 주는 진폭·주기를 그대로 쓰므로 난이도는 안 바뀐다.

// 이 비율 아래로 느려지면 옆모습에서 정면으로 섞기 시작한다. sin 운동이라
// 양 끝에서 속도가 0이 되고, 그 순간이 플레이어를 보는 순간이 된다.
const FACE_THRESHOLD = 0.25;

// 모델은 rotation.y = 0에서 +Z(플레이어)를 본다. +Z를 Y축으로 θ 돌리면
// (sinθ, 0, cosθ)이므로 +X를 향하려면 θ = +π/2다.
const RIGHT_FACING = Math.PI / 2;

export function createPatrol({ amplitude, frequency, phase }) {
  return {
    sample(elapsed, dt) {
      const angle = elapsed * frequency + phase;
      const cosine = Math.cos(angle);
      const speedNorm = Math.abs(cosine);
      const taunt = Math.max(0, 1 - speedNorm / FACE_THRESHOLD);

      // 타워 위 원숭이는 진폭이 0이다. 안 움직이니 몸을 틀 방향도 걸음도 없다.
      if (amplitude === 0) {
        return { offsetX: 0, facing: 0, gaitDelta: 0, taunt };
      }

      const blend = Math.min(speedNorm / FACE_THRESHOLD, 1);
      const direction = cosine >= 0 ? 1 : -1;

      return {
        offsetX: Math.sin(angle) * amplitude,
        facing: direction * RIGHT_FACING * blend,
        gaitDelta: speedNorm * amplitude * frequency * dt,
        taunt,
      };
    },
  };
}

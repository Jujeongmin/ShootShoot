// 원숭이의 좌우 순찰 곡선. THREE에 의존하지 않는 순수 모듈이라
// 궤적·방향 전환·걸음 진행을 테스트로 못 박을 수 있다.
//
// 곡선은 이제 넷이다(BEHAVIOR_POWER 참고) -- steady(p=1)만 예전 monkey.ts의
// updateIdle이 인라인으로 갖고 있던 sin 곡선과 그대로 같고, pause/dash/bob은
// 일부러 다르게 움직이도록 새로 만든 것이다. 진폭도 laneLayout.ts가 낸 값을
// 그대로 받지 않는다 -- targetManager.ts가 개체별 speedScale을 곱해 넘기므로
// 여기 amplitude는 이미 그 배율이 반영된 값이다.

import type { BehaviorId } from './roundComposition';

// 이 비율 아래로 느려지면 옆모습에서 정면으로 섞기 시작한다. sin 운동이라
// 곡선이 멈추는 지점에서 속도가 0이 되고, 그 순간이 플레이어를 보는 순간이 된다.
// steady/pause/bob 은 양 끝뿐이지만 dash 는 가운데도 한 번 멈췄다 가므로
// 그 순간에도 정면을 보고 도발한다.
const FACE_THRESHOLD = 0.25;

// 모델은 rotation.y = 0에서 +Z(플레이어)를 본다. +Z를 Y축으로 θ 돌리면
// (sinθ, 0, cosθ)이므로 +X를 향하려면 θ = +π/2다.
const RIGHT_FACING = Math.PI / 2;

export interface PatrolSample {
  offsetX: number;
  offsetY: number;
  facing: number;
  gaitDelta: number;
  stride: number;
  taunt: number;
}

interface PatrolParams {
  amplitude: number;
  frequency: number;
  phase: number;
  behavior: BehaviorId;
}

// 곡선을 sign(sin a) x |sin a|^p 하나로 통일한다. p = 1 이면 그냥 sin 이라
// steady 가 예전 식과 완전히 같다. p < 1 은 양 끝에 머물고, p > 1 은 가운데서 끌다
// 양 끝으로 빠르게 간다. dash 는 2.2에서는 최고 속도가 steady보다 3%밖에 안 빨라
// 티가 안 났다 -- 3.0은 약 15% 더 빠르고 가운데 머무는 것도 뚜렷하다. 그래도 안
// 읽히면 이 값을 더 올린다.
const BEHAVIOR_POWER: Record<BehaviorId, number> = {
  steady: 1,
  pause: 0.55,
  dash: 3.0,
  bob: 1,
};

// bob 의 세로 흔들림. 좌우 주기와 정수배가 되면 두 축이 맞물려 한 방향으로
// 기울어진 직선처럼 보이므로 무리수에 가까운 비율을 쓴다.
const BOB_RATIO = 2.3;
// 위로만 흔든다. 대칭으로 흔들면 절반의 시간 동안 발이 지면을 파고든다 --
// monkey.ts 의 걷기 흔들림이 같은 이유로 이미 위로만 간다. 통로 원숭이는
// 단단한 발판 위에 서 있어서 아래로 내려가면 판을 뚫고 나간다.
const BOB_AMPLITUDE = 0.35;

// p < 1 이면 속도가 sin = 0 에서 발산한다. 0 으로 나누지 않도록 크기를 바닥에서
// 막고, 그래도 남는 큰 값은 아래에서 1 로 자른다. 위치(value)에는 안 쓴다 --
// 여기 섞으면 교차점에서 pause 가 0 대신 진폭의 2.24%로 튀어버린다.
const MAGNITUDE_FLOOR = 1e-3;

export function createPatrol({ amplitude, frequency, phase, behavior }: PatrolParams) {
  const power = BEHAVIOR_POWER[behavior];

  // value 와 (걸음용) 이전 값이 같은 공식을 쓰도록 한 곳에 모은다. power가 1이면
  // 그냥 sin이라 steady/bob의 offsetX가 예전 식과 완전히 같다.
  const shapeAt = (angle: number) => {
    const sine = Math.sin(angle);
    return power === 1 ? sine : Math.sign(sine) * Math.pow(Math.abs(sine), power);
  };

  return {
    sample(elapsed: number, dt: number): PatrolSample {
      const angle = elapsed * frequency + phase;
      const sine = Math.sin(angle);
      const cosine = Math.cos(angle);

      // 정규화 위치와 그 속도. power 가 1 이면 각각 sin, cos 라 예전과 같다.
      const value = shapeAt(angle);
      const rawSpeed =
        power === 1
          ? Math.abs(cosine)
          : power * Math.pow(Math.max(Math.abs(sine), MAGNITUDE_FLOOR), power - 1) * Math.abs(cosine);
      const speedNorm = Math.min(rawSpeed, 1);

      const taunt = Math.max(0, 1 - speedNorm / FACE_THRESHOLD);

      // 타워 위 원숭이는 진폭이 0이다. 안 움직이니 몸을 틀 방향도 걸음도 없다.
      // stride도 0이어야 한다 — 실제로 이동하지 않으므로, 다리를 벌린 채 굳는 대신
      // idle 클립 포즈 그대로 서 있어야 한다.
      if (amplitude === 0) {
        return { offsetX: 0, offsetY: 0, facing: 0, gaitDelta: 0, stride: 0, taunt };
      }

      // 몸을 트는 정도와 다리를 흔드는 정도가 같은 곡선을 쓴다. 걸음이 온전한 구간에서
      // 옆을 보고, 멈추는 순간에 정면으로 돌며 다리를 모은다.
      //
      // stride에 speedNorm을 그대로 쓰면 안 된다. |cos| < 0.5인 구간이 매 주기의
      // 3분의 1이라, 다리 스윙 폭이 그만큼 오래 죽어 걷기 동작이 사라진 것처럼 보인다.
      // 여기서 잘라 줘야 실제로 멈추는 순간에만 다리가 모인다.
      const stride = Math.min(speedNorm / FACE_THRESHOLD, 1);
      const direction = cosine >= 0 ? 1 : -1;

      // 걸음은 실제로 나아간 거리를 따라야 발이 안 미끄러진다. steady/bob(둘 다
      // power 1)은 예전처럼 해석적으로 두어 수치가 그대로고, 나머지는 속도를
      // 자르는 바람에 거리와 어긋나므로 이번 프레임에 실제로 움직인 만큼을 쓴다.
      const gaitDelta =
        power === 1
          ? speedNorm * amplitude * frequency * dt
          : Math.abs(value - shapeAt(angle - frequency * dt)) * amplitude;

      return {
        offsetX: value * amplitude,
        offsetY:
          behavior === 'bob'
            ? ((Math.sin(angle * BOB_RATIO + phase) + 1) / 2) * BOB_AMPLITUDE
            : 0,
        facing: direction * RIGHT_FACING * stride,
        gaitDelta,
        stride,
        taunt,
      };
    },
  };
}

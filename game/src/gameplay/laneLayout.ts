import type { FormationId } from './roundComposition';

const FRONT_Z = -78;
const BASE_DEPTH_GAP = 6;
const MAX_LANE_ANGLE = 0.09;
const ANGULAR_SWAY_AMPLITUDE = 0.038;
const SWAY_FREQUENCY_PER_SPEED = 1.8;
const GROUND_Y = -1.0;

// wide 는 각도를 넓혀 좌우로 벌린다. 섬 반폭이 13이라 여기가 빡빡하다.
//
// 계산은 가장 바깥·가장 깊은 슬롯으로 해야 한다. wide 는 레인당 2마리라 깊이가
// z = -84 까지 가고, 각도와 순찰 진폭이 둘 다 |z| 에 비례하므로 거기가 최대다.
//   1.2 → 0.09 x 1.2 x 84 = 9.07, 진폭 0.038 x 84 = 3.19, 합 12.26  (안전)
//   1.3 → 9.83 + 3.19 = 13.02                                        (섬 밖)
// 1.3 을 먼저 넣었다가 계산에서 걸렸다. 올리려면 진폭까지 같이 봐야 한다.
const WIDE_ANGLE_SCALE = 1.2;
// 쐐기와 엇갈림이 깊이를 미는 정도. 깊이 간격의 절반이라 앞뒤 줄이 겹치지 않는다.
const DEPTH_STEP_RATIO = 0.5;

function partitionIntoLanes(count: number, perLane: number): number[] {
  if (count === 1) return [1];
  const remainder = count % perLane;
  let full = Math.floor(count / perLane);
  let short = 0;
  if (remainder === 1 && perLane > 2) {
    full -= 1;
    short = 2;
  } else if (remainder > 0) {
    short = 1;
  }
  const sizes: number[] = [];
  for (let i = 0; i < full; i += 1) sizes.push(perLane);
  for (let i = 0; i < short; i += 1) sizes.push(remainder === 1 && perLane > 2 ? 2 : remainder);
  return sizes;
}

// 대형마다 다른 것은 셋뿐이다 — 레인당 인원, 각도 배율, 레인별 깊이 밀기.
// 나머지 계산은 공유한다.
function formationShape(formation: FormationId) {
  switch (formation) {
    case 'wide':
      return { perLane: 2, angleScale: WIDE_ANGLE_SCALE, depthPush: () => 0 };
    case 'wedge':
      // 가운데 레인이 앞, 바깥으로 갈수록 뒤로 물러난다.
      //
      // 기준을 (laneCount-1)/2 같은 분수 중심으로 잡으면 안 된다. 레인이 둘일 때
      // 두 레인의 거리가 0.5 로 같아져서 똑같이 밀리고, 쐐기가 아니라 전체가 뒤로
      // 간 columns 가 된다. 원숭이 4~6마리가 레인 둘이고 4라운드가 정확히 6마리라,
      // 대형이 처음 열리는 라운드가 그 경우에 걸린다.
      //
      // 실제 레인 하나를 기준으로 삼으면 그 레인의 밀기가 0 이라 맨 앞이 되고,
      // 나머지가 거리만큼 물러난다. 레인이 둘이면 0 과 1 로 갈라진다.
      return {
        perLane: 3,
        angleScale: 1,
        depthPush: (laneIndex: number, laneCount: number) =>
          Math.abs(laneIndex - Math.floor((laneCount - 1) / 2)) * DEPTH_STEP_RATIO,
      };
    case 'staggered':
      // 이웃한 레인이 반 칸씩 엇갈린다.
      return {
        perLane: 3,
        angleScale: 1,
        depthPush: (laneIndex: number) => (laneIndex % 2) * DEPTH_STEP_RATIO,
      };
    case 'columns':
    default:
      return { perLane: 3, angleScale: 1, depthPush: () => 0 };
  }
}

export function computeLaneLayout(
  monkeyCount: number,
  monkeySpeed: number,
  monkeyScale: number,
  formation: FormationId
) {
  const shape = formationShape(formation);
  const laneSizes = partitionIntoLanes(monkeyCount, shape.perLane);
  const laneCount = laneSizes.length;
  const frequency = SWAY_FREQUENCY_PER_SPEED * monkeySpeed;
  const depthGap = BASE_DEPTH_GAP * monkeyScale;
  const maxAngle = MAX_LANE_ANGLE * shape.angleScale;
  const slots = [];

  for (let laneIndex = 0; laneIndex < laneCount; laneIndex++) {
    const laneAngle =
      laneCount === 1 ? 0 : -maxAngle + (2 * maxAngle * laneIndex) / (laneCount - 1);
    const size = laneSizes[laneIndex];
    const push = shape.depthPush(laneIndex, laneCount);
    for (let j = 0; j < size; j++) {
      const z = FRONT_Z - (j + push) * depthGap;
      slots.push({
        x: laneAngle * Math.abs(z),
        y: GROUND_Y,
        z,
        swayAmplitude: ANGULAR_SWAY_AMPLITUDE * Math.abs(z),
        swayFrequency: frequency,
        swayPhase: (j * 2 * Math.PI) / size,
      });
    }
  }

  return slots;
}

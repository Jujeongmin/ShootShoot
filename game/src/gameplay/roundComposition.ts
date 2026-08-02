import { createSeededRandom } from './skyMotion';

export type BehaviorId = 'steady' | 'pause' | 'dash' | 'bob';
export type FormationId = 'columns' | 'wedge' | 'wide' | 'staggered';

export interface MonkeyPlan {
  behavior: BehaviorId;
  speedScale: number;
  sizeScale: number;
}

export interface RoundComposition {
  structureCount: number;
  laneCount: number;
  formation: FormationId;
  monkeys: MonkeyPlan[];
}

// createSeededRandom 은 LCG 라 이웃한 씨앗의 첫 출력이 거의 붙어 나온다
// (1664525 / 2^32 ≈ 0.0004 차이). 라운드 번호를 그대로 넣으면 12라운드와
// 13라운드 구성이 사실상 같아진다.
//
// 큰 홀수 하나를 곱해 비트를 흩는 것만으로는 부족하다 — 곱셈은 그 자체로
// 선형 변환이라, "라운드 번호 → 흩기 → LCG 한 걸음"을 다 합쳐도 결국
// 라운드 번호에 대해 또 하나의 선형(곱셈) 관계로 접힌다. 이 예제에서 그
// 합쳐진 배율은 2^32 의 약 2%에 불과해서, 인접한 라운드 5개가 뽑는 첫
// 값이 여전히 한 구간 안에 뭉쳤다 (실측: round 10~14가 전부 같은 결과를
// 냈다). 그래서 시프트와 XOR을 섞은 비선형 마무리(murmur3 fmix32 계열)로
// 비트를 완전히 휘저은 뒤 시드로 넣는다.
function hashRound(roundNumber: number): number {
  let x = roundNumber >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}

// 테스트가 이웃 라운드의 씨앗이 실제로 갈라지는지 직접 확인한다. 구성 결과로
// 확인하면 태스크 3에서 대형이 붙기 전까지는 확인할 방법이 없다.
export function roundSeed(roundNumber: number): number {
  return hashRound(roundNumber);
}

// 구조물 슬롯이 그 라운드의 원숭이 수보다 많을 수 있다. 타워 둘에 통로 둘이면
// 슬롯이 넷인데 1라운드 원숭이는 셋이다. 슬롯을 먼저 다 채우면 레인이 비어서
// 판 전체가 구조물 위에만 서 있게 되고, 통로 하나 무너뜨리면 판이 끝난다.
// 그래서 레인에 최소 한 마리는 남긴다.
//
// 라운드에 따라 이 비율을 흔드는 것은 태스크 5가 한다. 해금 라운드가 15라
// 여기서 미리 흔들면 안 된다.
function splitBetweenStructuresAndLanes(monkeyCount: number, structureSlotCount: number) {
  const structureCount = Math.min(structureSlotCount, Math.max(0, monkeyCount - 1));
  return { structureCount, laneCount: monkeyCount - structureCount };
}

// 전부 한 번에 열면 1라운드가 아수라장이 되고 튜토리얼이 그 위에 얹혀 있다.
const FORMATION_UNLOCK_ROUND = 4;

// FormationId 와 이 배열이 어긋나면 새 대형을 넣고도 뽑히지 않는다. 한 곳에 둔다.
export const FORMATIONS: FormationId[] = ['columns', 'wedge', 'wide', 'staggered'];

// 해금 라운드. 어려운 것일수록 늦게 연다.
const BEHAVIOR_UNLOCK_ROUND: Record<BehaviorId, number> = {
  steady: 1,
  pause: 6,
  dash: 10,
  bob: 15,
};

// 난이도 가중치. pause 는 양 끝에 오래 머물러 오히려 맞히기 쉽다.
const BEHAVIOR_WEIGHT: Record<BehaviorId, number> = {
  steady: 0,
  pause: -1,
  dash: 2,
  bob: 2,
};

const BEHAVIORS: BehaviorId[] = ['steady', 'pause', 'dash', 'bob'];

// 한 판에 어려운 것이 몰리지 않게 가중치 합에 상한을 건다. 안 걸면 dash 와 bob 만
// 열 마리인 판이 나온다. 4라운드에 0 에서 시작해 두 라운드마다 1씩 오른다.
function difficultyBudget(roundNumber: number) {
  return Math.max(0, Math.floor((roundNumber - 4) / 2));
}

export function composeRound(
  roundNumber: number,
  monkeyCount: number,
  structureSlotCount: number
): RoundComposition {
  const { structureCount, laneCount } = splitBetweenStructuresAndLanes(
    monkeyCount,
    structureSlotCount
  );

  const random = createSeededRandom(roundSeed(roundNumber));

  const formation =
    roundNumber < FORMATION_UNLOCK_ROUND
      ? 'columns'
      : FORMATIONS[Math.floor(random() * FORMATIONS.length)];

  const unlocked = BEHAVIORS.filter((id) => roundNumber >= BEHAVIOR_UNLOCK_ROUND[id]);
  let budget = difficultyBudget(roundNumber);

  const monkeys: MonkeyPlan[] = [];
  for (let i = 0; i < monkeyCount; i += 1) {
    // 예산 안에 드는 것만 후보다. steady 는 가중치 0 이라 항상 남는다.
    const affordable = unlocked.filter((id) => BEHAVIOR_WEIGHT[id] <= budget);
    const behavior = affordable[Math.floor(random() * affordable.length)];
    budget -= BEHAVIOR_WEIGHT[behavior];
    monkeys.push({ behavior, speedScale: 1, sizeScale: 1 });
  }

  return { structureCount, laneCount, formation, monkeys };
}

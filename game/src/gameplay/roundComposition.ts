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
// 15라운드부터는 구조물을 덜 쓰는 판도 섞는다. 항상 슬롯을 꽉 채우면 어느 판이나
// 구조물부터 부수는 같은 순서로 풀린다.
function splitBetweenStructuresAndLanes(
  monkeyCount: number,
  structureSlotCount: number,
  roundNumber: number,
  random: () => number
) {
  const ceiling = Math.min(structureSlotCount, Math.max(0, monkeyCount - 1));
  if (roundNumber < STRUCTURE_EMPHASIS_UNLOCK_ROUND) {
    return { structureCount: ceiling, laneCount: monkeyCount - ceiling };
  }
  // 0 은 안 쓴다 -- 구조물이 통째로 비면 무너뜨리는 재미가 사라진다. ceiling 이 0일
  // 때(슬롯이 없거나 원숭이가 하나뿐일 때)만 예외로 0을 낸다.
  const structureCount = ceiling === 0 ? 0 : 1 + Math.floor(random() * ceiling);
  return { structureCount, laneCount: monkeyCount - structureCount };
}

// 전부 한 번에 열면 1라운드가 아수라장이 되고 튜토리얼이 그 위에 얹혀 있다.
const FORMATION_UNLOCK_ROUND = 4;

// 개체 차이와 구조물 편중이 풀리는 라운드.
const VARIANCE_UNLOCK_ROUND = 6;
const STRUCTURE_EMPHASIS_UNLOCK_ROUND = 15;

// 빠른 놈은 작고 느린 놈은 크다. 크기가 난이도 신호라 플레이어가 뭘 먼저 쏠지
// 고를 수 있다. 체력은 안 건드린다 -- 개체마다 다르면 점수·정산과 얽힌다.
//
// speedScale은 이제 순찰 주기가 아니라 진폭(폭)에 실린다(targetManager.ts) --
// 주기를 개체마다 다르게 하면 이웃 슬롯과의 위상차가 흘러서 서로를 뚫고
// 지나가기 때문이다. wide 대형은 이미 섬 반폭 13에 거의 닿아 있어서(진폭까지
// 합쳐 12.26, laneLayout.ts 참고) 배율을 크게 못 준다 -- 1.4는 물론 1.25도
// 실측하면 13.06으로 섬 밖이다(9.072 + 3.192 × 1.25). 1.2까지 낮춰야
// 12.90으로 안쪽에 남는다.
const VARIANTS = [
  { speedScale: 0.8, sizeScale: 1.15 },
  { speedScale: 1.0, sizeScale: 1.0 },
  { speedScale: 1.2, sizeScale: 0.85 },
];

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

// pause 는 가중치가 음수라 예산을 돌려주고, 그래서 언제나 후보에 남는다. 균등하게
// 뽑으면 해금되는 순간 판을 뒤덮어서 6라운드가 5라운드보다 쉬워진다 — 실측으로
// 8마리 중 6마리가 pause 였다. 쉬운 것에도 상한을 둔다.
const EASY_BEHAVIOR_SHARE = 1 / 3;

// 한 판에 어려운 것이 몰리지 않게 가중치 합에 상한을 건다. pause 가 예산을
// 돌려주므로(가중치 -1) 실제로는 절반이 아니라, pause 를 최대 easyLimit 개
// 뽑아 돌려받는 만큼(최대 세 마리, 10마리 기준) 더 써서 열 마리 중 최대 여섯이
// dash/bob 일 수 있다. 4라운드에 0 에서 시작해 두 라운드마다 1씩 오른다.
//
// 어려운 것의 가중치가 2 라 원숭이 수의 두 배가 실제 상한이다. monkeyCount 로
// 묶으면 24라운드에서 예산이 멈춰서 그 뒤로 난이도가 제자리걸음이 된다.
function difficultyBudget(roundNumber: number, monkeyCount: number) {
  return Math.max(0, Math.min(Math.floor((roundNumber - 4) / 2), monkeyCount * 2));
}

export function composeRound(
  roundNumber: number,
  monkeyCount: number,
  staticStructureSlots: readonly boolean[]
): RoundComposition {
  const random = createSeededRandom(roundSeed(roundNumber));

  // 난수를 뽑는 순서가 결과를 정한다. 구조물 편중부터 뽑고, 그다음 대형,
  // 그다음 behavior/개체차이 순으로 고정해야 라운드마다 같은 자리에서 같은
  // 값이 나온다.
  //
  // 구조물 슬롯 수는 staticStructureSlots.length 에서 그대로 뽑는다 -- 이걸
  // 별도 인자로 또 받으면 둘이 어긋날 여지가 생기고, 어긋나는 순간 아래
  // flag 조회(staticStructureSlots[i])가 undefined 를 내놓아 모든 타워
  // 원숭이가 behavior 를 뽑고 예산이 얼어붙은 슬롯에 낭비된다 -- 정확히
  // flag 배열을 도입한 이유였던 그 버그다.
  const { structureCount, laneCount } = splitBetweenStructuresAndLanes(
    monkeyCount,
    staticStructureSlots.length,
    roundNumber,
    random
  );

  const formation =
    roundNumber < FORMATION_UNLOCK_ROUND
      ? 'columns'
      : FORMATIONS[Math.floor(random() * FORMATIONS.length)];

  const unlocked = BEHAVIORS.filter((id) => roundNumber >= BEHAVIOR_UNLOCK_ROUND[id]);
  let budget = difficultyBudget(roundNumber, monkeyCount);
  const easyLimit = Math.floor(monkeyCount * EASY_BEHAVIOR_SHARE);
  let easyTaken = 0;

  const monkeys: MonkeyPlan[] = [];
  for (let i = 0; i < monkeyCount; i += 1) {
    // 진폭이 0인 슬롯(진짜 타워)은 patrolMotion이 곡선과 상관없이 제자리에 세운다.
    // 어떤 behavior/개체차이를 줘도 화면에는 안 보이므로 뽑지 않고 고정한다 --
    // 예산·쉬운 자리 몫·개체 편차 추첨 모두 그 자리에 낭비하지 않는다.
    //
    // 개수(staticSlotCount) 대신 슬롯별 flag 배열을 받는 이유: 정적 슬롯이
    // 항상 배열 앞쪽에 몰려 있다는 보장이 없다. 지금은 obstacles.ts 가 타워를
    // 먼저 push 해서 우연히 그렇게 되지만, 그 순서가 바뀌면 개수 비교로는
    // 엉뚱한 자리를 얼려버리고도 조용히 넘어간다. flag 배열은 순서에 기대지
    // 않는다.
    const isStatic = i < structureCount && staticStructureSlots[i];
    if (isStatic) {
      monkeys.push({ behavior: 'steady', speedScale: 1, sizeScale: 1 });
      continue;
    }

    // 예산 안에 들고, 쉬운 것이면 몫이 남은 것만 후보다. steady 는 가중치 0 이라
    // 항상 남는다.
    const affordable = unlocked.filter((id) => {
      if (BEHAVIOR_WEIGHT[id] > budget) return false;
      if (BEHAVIOR_WEIGHT[id] < 0 && easyTaken >= easyLimit) return false;
      return true;
    });
    // 예산을 천장으로만 쓰면 높은 라운드에서도 uniform 추첨이라 난이도가 안 오른다.
    // 남은 원숭이 한 마리당 예산이 넉넉할수록 어려운 쪽을 고를 확률을 올린다.
    //
    // pressure 판정이 매번 난수를 하나 소비하고, uniform 추첨은 그 판정이
    // 실패했을 때만 두 번째 난수를 더 쓴다 -- 마리당 뽑는 난수 개수가 갈린다.
    // 결과가 라운드 번호만의 순수 함수라는 결정성에는 문제없다(같은 라운드는
    // 항상 같은 씨앗에서 같은 순서로 뽑으므로). 그저 "원숭이당 난수 하나"라고
    // 가정하면 안 된다는 뜻이다.
    const remaining = monkeyCount - i;
    const pressure = Math.min(budget / (2 * remaining), 1);
    const hardest = affordable.reduce((a, b) => (BEHAVIOR_WEIGHT[b] > BEHAVIOR_WEIGHT[a] ? b : a));
    const behavior =
      random() < pressure ? hardest : affordable[Math.floor(random() * affordable.length)];
    budget -= BEHAVIOR_WEIGHT[behavior];
    if (BEHAVIOR_WEIGHT[behavior] < 0) easyTaken += 1;

    const variant =
      roundNumber < VARIANCE_UNLOCK_ROUND
        ? { speedScale: 1, sizeScale: 1 }
        : VARIANTS[Math.floor(random() * VARIANTS.length)];
    monkeys.push({ behavior, speedScale: variant.speedScale, sizeScale: variant.sizeScale });
  }

  return { structureCount, laneCount, formation, monkeys };
}

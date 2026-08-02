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

function seedFor(roundNumber: number) {
  return createSeededRandom(hashRound(roundNumber));
}

// 튜토리얼이 1~3라운드 위에 그대로 서 있다 (요구사항: 이 세 판은 오늘과
// 한 치도 달라지면 안 된다). 그래서 구조물 배분에 씨앗을 섞는 건 그 뒤
// 라운드부터로 한정한다 — 셋 이하에서는 항상 옛 규칙(꽉 채우고 레인에
// 하나만 남기기) 그대로 나간다.
const EXACT_MATCH_THROUGH_ROUND = 3;

// 구조물 슬롯이 그 라운드의 원숭이 수보다 많을 수 있다. 타워 둘에 통로 둘이면
// 슬롯이 넷인데 1라운드 원숭이는 셋이다. 슬롯을 먼저 다 채우면 레인이 비어서
// 판 전체가 구조물 위에만 서 있게 되고, 통로 하나 무너뜨리면 판이 끝난다.
// 그래서 레인에 최소 한 마리는 남긴다.
//
// 몬키 수가 슬롯보다 훨씬 많아지는 라운드(8라운드부터 몬키 수가 상한 10에서
// 멈춘다)에서는 이 몫이 라운드 번호와 무관하게 늘 같은 값으로 굳어버린다 —
// 이웃 라운드끼리 판이 겹치는 원인 중 하나다. 그래서 4라운드부터는 씨앗이
// "구조물에 몇 마리까지 세울지"를 0~최댓값 사이에서 고른다.
function splitBetweenStructuresAndLanes(
  roundNumber: number,
  monkeyCount: number,
  structureSlotCount: number,
  random: () => number
) {
  const maxStructureCount = Math.min(structureSlotCount, Math.max(0, monkeyCount - 1));
  if (roundNumber <= EXACT_MATCH_THROUGH_ROUND) {
    return { structureCount: maxStructureCount, laneCount: monkeyCount - maxStructureCount };
  }
  const structureCount = Math.floor(random() * (maxStructureCount + 1));
  return { structureCount, laneCount: monkeyCount - structureCount };
}

export function composeRound(
  roundNumber: number,
  monkeyCount: number,
  structureSlotCount: number
): RoundComposition {
  const random = seedFor(roundNumber);

  const { structureCount, laneCount } = splitBetweenStructuresAndLanes(
    roundNumber,
    monkeyCount,
    structureSlotCount,
    random
  );

  const monkeys: MonkeyPlan[] = [];
  for (let i = 0; i < monkeyCount; i += 1) {
    monkeys.push({ behavior: 'steady', speedScale: 1, sizeScale: 1 });
  }

  return { structureCount, laneCount, formation: 'columns', monkeys };
}

import * as THREE from 'three';
import { createMonkey, type Monkey } from './monkey';
import { getRoundParams } from './difficulty';
import { computeLaneLayout } from './laneLayout';
import { composeRound } from './roundComposition';
import type { loadMonkeyModel } from './monkeyModel';
import type { StructureSlot } from './obstacles';

// 원숭이를 놓을 때 지면보다 이만큼 내린다. 레인 원숭이와 타워 위 원숭이 모두에
// 같이 적용되도록 배치 지점 한 곳에서만 뺀다.
const MONKEY_DROP = 0;

// getRoundParams가 실제로 받는 모양 그대로를 가져다 쓴다 — RoundConfig를
// difficulty.ts에서 따로 export하지 않아도 된다.
type RoundConfig = Parameters<typeof getRoundParams>[1];
// loadMonkeyModel이 실제로 반환하는 모양 그대로를 가져다 쓴다.
type MonkeyModel = Awaited<ReturnType<typeof loadMonkeyModel>>;

export function createTargetManager(
  scene: THREE.Scene,
  config: RoundConfig,
  monkeyModel: MonkeyModel,
  towerSlots: StructureSlot[]
) {
  let monkeys: Monkey[] = [];
  let nextId = 0;
  let towerMonkeyIds = new Map<number, string[]>();

  function clear() {
    for (const monkey of monkeys) {
      scene.remove(monkey.group);
      monkey.dispose();
    }
    monkeys = [];
    towerMonkeyIds = new Map();
  }

  function spawnRound(roundNumber: number) {
    clear();
    const params = getRoundParams(roundNumber, config);

    // 타워 슬롯은 진폭이 0이라 어떤 behavior 를 줘도 제자리에 선다. 구성기가
    // 그 자리에 어려운 움직임을 배정하면 난이도 예산만 쓰고 화면에는 안 나타난다.
    const staticSlotCount = towerSlots.filter((slot) => slot.sway.amplitude === 0).length;
    const composition = composeRound(
      roundNumber,
      params.monkeyCount,
      towerSlots.length,
      staticSlotCount
    );
    const structureCount = composition.structureCount;
    const laneMonkeyCount = composition.laneCount;

    // 슬롯 순서가 우선순위다. 원숭이가 모자라면 뒤쪽 슬롯이 빈 채로 남는다.
    for (let i = 0; i < structureCount; i++) {
      const slot = towerSlots[i];
      const monkey = createMonkey({
        id: `monkey-${nextId++}`,
        position: { x: slot.x, y: slot.y - MONKEY_DROP, z: slot.z },
        scale: params.monkeyScale,
        speed: params.monkeySpeed,
        template: monkeyModel.template,
        clip: monkeyModel.clip,
        // 순찰 폭과 위상은 슬롯이 정한다. 제자리에 서는 타워는 진폭 0,
        // 통로는 발판 길이 안에서 오갈 만큼의 진폭을 싣고 온다.
        sway: {
          amplitude: slot.sway.amplitude,
          frequency: slot.sway.frequencyPerSpeed * params.monkeySpeed,
          phase: slot.sway.phase,
        },
        hp: params.monkeyHp,
        behavior: composition.monkeys[i].behavior,
      });
      scene.add(monkey.group);
      monkeys.push(monkey);
      const ids = towerMonkeyIds.get(slot.towerIndex) ?? [];
      ids.push(monkey.id);
      towerMonkeyIds.set(slot.towerIndex, ids);
    }
    const layout = computeLaneLayout(
      laneMonkeyCount,
      params.monkeySpeed,
      params.monkeyScale,
      composition.formation
    );
    for (let i = 0; i < laneMonkeyCount; i++) {
      const slot = layout[i];
      const monkey = createMonkey({
        id: `monkey-${nextId++}`,
        position: { x: slot.x, y: slot.y - MONKEY_DROP, z: slot.z },
        scale: params.monkeyScale,
        speed: params.monkeySpeed,
        template: monkeyModel.template,
        clip: monkeyModel.clip,
        sway: { amplitude: slot.swayAmplitude, frequency: slot.swayFrequency, phase: slot.swayPhase },
        hp: params.monkeyHp,
        behavior: composition.monkeys[structureCount + i].behavior,
      });
      scene.add(monkey.group);
      monkeys.push(monkey);
    }

    return params;
  }

  function update(dt: number) {
    for (const monkey of monkeys) monkey.update(dt);
    monkeys = monkeys.filter((monkey) => {
      if (monkey.isDead()) {
        scene.remove(monkey.group);
        monkey.dispose();
        return false;
      }
      return true;
    });
  }

  function getRaycastMeshes() {
    return monkeys.flatMap((monkey) => monkey.getRaycastMeshes());
  }

  function findMonkey(id: string) {
    return monkeys.find((monkey) => monkey.id === id);
  }

  // 통로처럼 한 구조물에 여럿이 서 있을 수 있다. 죽어서 이미 목록에서 빠진 id는
  // 걸러낸다 — 붕괴가 죽는 연출 도중에 또 들어올 수 있다.
  function findMonkeysAtTower(towerIndex: number) {
    const ids = towerMonkeyIds.get(towerIndex);
    if (!ids) return [];
    return ids.map((id) => findMonkey(id)).filter((monkey): monkey is Monkey => monkey !== undefined);
  }

  function allCleared() {
    return monkeys.length === 0;
  }

  function hasDyingMonkeys() {
    return monkeys.some((monkey) => monkey.isDying());
  }

  function hasAliveMonkeys() {
    return monkeys.some((monkey) => !monkey.isDying());
  }

  function getMonkeys() {
    return monkeys;
  }

  return {
    spawnRound,
    update,
    getRaycastMeshes,
    findMonkey,
    findMonkeysAtTower,
    allCleared,
    clear,
    hasDyingMonkeys,
    hasAliveMonkeys,
    getMonkeys,
  };
}

import { createMonkey } from './monkey.js';
import { getRoundParams } from './difficulty.js';
import { computeLaneLayout } from './laneLayout.js';

// 원숭이를 놓을 때 지면보다 이만큼 내린다. 레인 원숭이와 타워 위 원숭이 모두에
// 같이 적용되도록 배치 지점 한 곳에서만 뺀다.
const MONKEY_DROP = 0.5;

export function createTargetManager(scene, config, monkeyModel, towerSlots) {
  let monkeys = [];
  let nextId = 0;
  let towerMonkeyIds = new Map();

  function clear() {
    for (const monkey of monkeys) {
      scene.remove(monkey.group);
      monkey.dispose();
    }
    monkeys = [];
    towerMonkeyIds = new Map();
  }

  function spawnRound(roundNumber) {
    clear();
    const params = getRoundParams(roundNumber, config);

    for (const slot of towerSlots) {
      const monkey = createMonkey({
        id: `monkey-${nextId++}`,
        position: { x: slot.x, y: slot.y - MONKEY_DROP, z: slot.z },
        scale: params.monkeyScale,
        speed: params.monkeySpeed,
        template: monkeyModel.template,
        clip: monkeyModel.clip,
        sway: { amplitude: 0, frequency: params.monkeySpeed, phase: 0 },
        hp: params.monkeyHp,
      });
      scene.add(monkey.group);
      monkeys.push(monkey);
      towerMonkeyIds.set(slot.towerIndex, monkey.id);
    }

    const laneMonkeyCount = params.monkeyCount - towerSlots.length;
    const layout = computeLaneLayout(laneMonkeyCount, params.monkeySpeed, params.monkeyScale);
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
      });
      scene.add(monkey.group);
      monkeys.push(monkey);
    }

    return params;
  }

  function update(dt) {
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

  function findMonkey(id) {
    return monkeys.find((monkey) => monkey.id === id);
  }

  function findMonkeyAtTower(towerIndex) {
    const id = towerMonkeyIds.get(towerIndex);
    return id ? findMonkey(id) : undefined;
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

  return {
    spawnRound,
    update,
    getRaycastMeshes,
    findMonkey,
    findMonkeyAtTower,
    allCleared,
    clear,
    hasDyingMonkeys,
    hasAliveMonkeys,
  };
}

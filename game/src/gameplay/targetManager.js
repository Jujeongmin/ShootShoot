import { createMonkey } from './monkey.js';
import { getRoundParams } from './difficulty.js';
import { computeLaneLayout } from './laneLayout.js';

export function createTargetManager(scene, config, monkeyModel) {
  let monkeys = [];
  let nextId = 0;

  function clear() {
    for (const monkey of monkeys) scene.remove(monkey.group);
    monkeys = [];
  }

  function spawnRound(roundNumber) {
    clear();
    const params = getRoundParams(roundNumber, config);
    const layout = computeLaneLayout(params.monkeyCount, params.monkeySpeed, params.monkeyScale);
    for (let i = 0; i < params.monkeyCount; i++) {
      const slot = layout[i];
      const monkey = createMonkey({
        id: `monkey-${nextId++}`,
        position: { x: slot.x, y: slot.y, z: slot.z },
        scale: params.monkeyScale,
        speed: params.monkeySpeed,
        template: monkeyModel.template,
        clip: monkeyModel.clip,
        sway: { amplitude: slot.swayAmplitude, frequency: slot.swayFrequency, phase: slot.swayPhase },
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

  function allCleared() {
    return monkeys.length === 0;
  }

  function hasDyingMonkeys() {
    return monkeys.some((monkey) => monkey.isDying());
  }

  function hasAliveMonkeys() {
    return monkeys.some((monkey) => !monkey.isDying());
  }

  return { spawnRound, update, getRaycastMeshes, findMonkey, allCleared, clear, hasDyingMonkeys, hasAliveMonkeys };
}

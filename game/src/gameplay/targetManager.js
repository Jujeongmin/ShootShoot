import { createMonkey } from './monkey.js';
import { getRoundParams } from './difficulty.js';

function computeSpawnPosition(index, count) {
  const spread = 8;
  const x = count === 1 ? 0 : (index - (count - 1) / 2) * (spread / (count - 1));
  const z = -14 - Math.random() * 4;
  const y = -1.0;
  return { x, y, z };
}

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
    for (let i = 0; i < params.monkeyCount; i++) {
      const position = computeSpawnPosition(i, params.monkeyCount);
      const monkey = createMonkey({
        id: `monkey-${nextId++}`,
        position,
        scale: params.monkeyScale,
        speed: params.monkeySpeed,
        template: monkeyModel.template,
        clip: monkeyModel.clip,
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

  return { spawnRound, update, getRaycastMeshes, findMonkey, allCleared, clear, hasDyingMonkeys };
}

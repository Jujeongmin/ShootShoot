export function computeUpgradeCost(level, config) {
  return Math.round(config.baseCost * config.costMultiplier ** level);
}

function readState(storage, key) {
  const raw = storage.getItem(key);
  if (raw === null) return { damageLevel: 0, offlineLevel: 0 };

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { damageLevel: 0, offlineLevel: 0 };
  }

  const damageLevel = Number.isInteger(parsed?.damageLevel) ? parsed.damageLevel : 0;
  const offlineLevel = Number.isInteger(parsed?.offlineLevel) ? parsed.offlineLevel : 0;
  return { damageLevel, offlineLevel };
}

export function createUpgradeStore(storage, key) {
  function write(state) {
    storage.setItem(key, JSON.stringify(state));
  }

  return {
    getDamageLevel() {
      return readState(storage, key).damageLevel;
    },
    getOfflineLevel() {
      return readState(storage, key).offlineLevel;
    },
    levelUpDamage() {
      const state = readState(storage, key);
      state.damageLevel += 1;
      write(state);
      return state.damageLevel;
    },
    levelUpOffline() {
      const state = readState(storage, key);
      state.offlineLevel += 1;
      write(state);
      return state.offlineLevel;
    },
  };
}

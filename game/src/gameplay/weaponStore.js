const DEFAULT_WEAPON_ID = 'basic';

function readState(storage, key) {
  const raw = storage.getItem(key);
  if (raw === null) return { owned: [DEFAULT_WEAPON_ID], equipped: DEFAULT_WEAPON_ID };

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { owned: [DEFAULT_WEAPON_ID], equipped: DEFAULT_WEAPON_ID };
  }

  const owned = Array.isArray(parsed?.owned) ? parsed.owned.filter((id) => typeof id === 'string') : [];
  if (!owned.includes(DEFAULT_WEAPON_ID)) owned.unshift(DEFAULT_WEAPON_ID);

  const equipped = owned.includes(parsed?.equipped) ? parsed.equipped : DEFAULT_WEAPON_ID;
  return { owned, equipped };
}

export function createWeaponStore(storage, key) {
  function write(state) {
    storage.setItem(key, JSON.stringify(state));
  }

  return {
    getOwned() {
      return readState(storage, key).owned;
    },
    getEquipped() {
      return readState(storage, key).equipped;
    },
    isOwned(id) {
      return readState(storage, key).owned.includes(id);
    },
    markOwned(id) {
      const state = readState(storage, key);
      if (state.owned.includes(id)) return;
      state.owned.push(id);
      write(state);
    },
    equip(id) {
      const state = readState(storage, key);
      if (!state.owned.includes(id)) return false;
      state.equipped = id;
      write(state);
      return true;
    },
  };
}

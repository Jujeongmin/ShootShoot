const DEFAULT_WEAPON_ID = 'basic';

interface WeaponState {
  owned: string[];
  equipped: string;
}

function readState(storage: Storage, key: string): WeaponState {
  const raw = storage.getItem(key);
  if (raw === null) return { owned: [DEFAULT_WEAPON_ID], equipped: DEFAULT_WEAPON_ID };

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { owned: [DEFAULT_WEAPON_ID], equipped: DEFAULT_WEAPON_ID };
  }

  const owned = Array.isArray(parsed?.owned)
    ? parsed.owned.filter((id: unknown) => typeof id === 'string')
    : [];
  if (!owned.includes(DEFAULT_WEAPON_ID)) owned.unshift(DEFAULT_WEAPON_ID);

  const equipped = owned.includes(parsed?.equipped) ? parsed.equipped : DEFAULT_WEAPON_ID;
  return { owned, equipped };
}

export function createWeaponStore(storage: Storage, key: string) {
  function write(state: WeaponState) {
    storage.setItem(key, JSON.stringify(state));
  }

  return {
    getOwned() {
      return readState(storage, key).owned;
    },
    getEquipped() {
      return readState(storage, key).equipped;
    },
    isOwned(id: string) {
      return readState(storage, key).owned.includes(id);
    },
    markOwned(id: string) {
      const state = readState(storage, key);
      if (state.owned.includes(id)) return;
      state.owned.push(id);
      write(state);
    },
    equip(id: string) {
      const state = readState(storage, key);
      if (!state.owned.includes(id)) return false;
      state.equipped = id;
      write(state);
      return true;
    },
  };
}

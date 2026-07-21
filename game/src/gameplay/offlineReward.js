export function calculateOfflineGold(elapsedMs, config) {
  if (elapsedMs <= 0) return 0;
  const elapsedHours = Math.min(elapsedMs / (60 * 60 * 1000), config.maxHours);
  return Math.floor(elapsedHours * config.goldPerHour);
}

export function createLastSeenStore(storage, key) {
  return {
    get() {
      const raw = storage.getItem(key);
      if (raw === null) return null;
      const value = Number.parseInt(raw, 10);
      return Number.isNaN(value) ? null : value;
    },
    set(timestamp) {
      storage.setItem(key, String(timestamp));
    },
  };
}

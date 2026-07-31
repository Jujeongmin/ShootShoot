interface OfflineRewardConfig {
  goldPerHour: number;
  maxHours: number;
}

export function calculateOfflineGold(elapsedMs: number, config: OfflineRewardConfig): number {
  if (elapsedMs <= 0) return 0;
  const elapsedHours = Math.min(elapsedMs / (60 * 60 * 1000), config.maxHours);
  return Math.floor(elapsedHours * config.goldPerHour);
}

export function createLastSeenStore(storage: Storage, key: string) {
  return {
    get() {
      const raw = storage.getItem(key);
      if (raw === null) return null;
      const value = Number.parseInt(raw, 10);
      return Number.isNaN(value) ? null : value;
    },
    set(timestamp: number) {
      storage.setItem(key, String(timestamp));
    },
  };
}

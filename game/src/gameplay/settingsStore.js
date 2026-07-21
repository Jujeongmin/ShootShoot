const DEFAULT_SETTINGS = { sensitivity: 1.0 };

export function createSettingsStore(storage, key) {
  return {
    get() {
      const raw = storage.getItem(key);
      if (raw === null) return { ...DEFAULT_SETTINGS };
      try {
        const parsed = JSON.parse(raw);
        const sensitivity = typeof parsed.sensitivity === 'number' ? parsed.sensitivity : DEFAULT_SETTINGS.sensitivity;
        return { sensitivity };
      } catch {
        return { ...DEFAULT_SETTINGS };
      }
    },
    set(settings) {
      storage.setItem(key, JSON.stringify(settings));
    },
  };
}

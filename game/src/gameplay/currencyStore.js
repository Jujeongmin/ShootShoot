export function createCurrencyStore(storage, key) {
  return {
    get() {
      const raw = storage.getItem(key);
      const value = raw === null ? 0 : Number.parseInt(raw, 10);
      return Number.isNaN(value) ? 0 : value;
    },
    earn(amount) {
      const next = this.get() + amount;
      storage.setItem(key, String(next));
      return next;
    },
    spend(amount) {
      const current = this.get();
      if (amount > current) return false;
      storage.setItem(key, String(current - amount));
      return true;
    },
  };
}

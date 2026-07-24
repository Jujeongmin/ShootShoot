export function createBazookaStore(storage, key) {
  function read() {
    const raw = storage.getItem(key);
    const value = raw === null ? 0 : Number.parseInt(raw, 10);
    return Number.isNaN(value) ? 0 : value;
  }

  function write(rounds) {
    storage.setItem(key, String(rounds));
  }

  return {
    getRounds() {
      return read();
    },
    refill(maxRounds) {
      write(maxRounds);
      return maxRounds;
    },
    consumeRound() {
      const next = Math.max(read() - 1, 0);
      write(next);
      return next;
    },
    reset() {
      write(0);
      return 0;
    },
  };
}

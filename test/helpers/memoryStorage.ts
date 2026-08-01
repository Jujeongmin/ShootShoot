// 실제 Storage 인터페이스 전체(length, clear, key, removeItem 포함)를 갖춰야
// createXStore(storage: Storage, ...)에 그대로 넘길 수 있다.
export function createMemoryStorage(initial?: Record<string, string>): Storage {
  const map = new Map<string, string>(initial ? Object.entries(initial) : []);
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    clear: () => {
      map.clear();
    },
    key: (index: number) => Array.from(map.keys())[index] ?? null,
    get length() {
      return map.size;
    },
  };
}

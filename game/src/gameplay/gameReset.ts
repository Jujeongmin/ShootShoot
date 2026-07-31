// 새 게임은 기록과 조작 설정만 남기고 전부 지운다. 어떤 키를 지울지를 손으로
// 나열하면 나중에 스토어가 하나 늘 때 여기를 고치는 걸 잊는다. config 의 키 이름
// 규칙에서 뽑고 남길 것만 뺀다.
//
// 민감도를 남기는 이유: 그건 게임 진행이 아니라 조작 환경이다. 새 게임을 한다고
// 손에 익은 값을 다시 맞추게 할 이유가 없다.
const KEY_SUFFIX = 'StorageKey';
const KEEP = ['highScoreStorageKey', 'settingsStorageKey'];

export function dataKeysToClear(config: Record<string, unknown>): string[] {
  return Object.keys(config)
    .filter((name) => name.endsWith(KEY_SUFFIX) && !KEEP.includes(name))
    // 이름이 *StorageKey 로 끝나는 항목만 걸렀으니 값은 항상 문자열이다.
    // 타입으로는 그 관계를 못 박을 수 없으므로 여기서만 단언한다.
    .map((name) => config[name] as string);
}

export function clearGameData(storage: Storage, keys: string[]): void {
  for (const key of keys) storage.removeItem(key);
}

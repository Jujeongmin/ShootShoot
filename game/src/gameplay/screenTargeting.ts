// three.js 를 직접 참조하지 않고 필요한 모양만 구조적으로 받는다 —
// three나 DOM에 기대지 않아야 프레임 루프 밖에서 테스트할 수 있다.

interface Vector3Like {
  x: number;
  y: number;
  z: number;
  clone(): Vector3Like;
  project(camera: unknown): Vector3Like;
}

interface ScreenRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface TargetableMonkey {
  isDying(): boolean;
  getCenterWorldPosition(): Vector3Like;
}

export function computeBlastRadiusPx(containerHeight: number, ratio: number): number {
  return containerHeight * ratio;
}

export function isPointInScreenBox(worldPoint: Vector3Like, camera: unknown, rect: ScreenRect, radiusPx: number): boolean {
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  // project()는 벡터를 제자리에서 바꾼다. 구조물은 중심 벡터를 재사용하므로
  // 반드시 복제해서 투영한다.
  const ndc = worldPoint.clone().project(camera);
  if (ndc.z > 1) return false; // 카메라 뒤

  const x = rect.left + (ndc.x * 0.5 + 0.5) * rect.width;
  const y = rect.top + (-ndc.y * 0.5 + 0.5) * rect.height;

  return Math.abs(x - centerX) <= radiusPx && Math.abs(y - centerY) <= radiusPx;
}

// 넘긴 원숭이를 그대로 골라 돌려준다. 제네릭이 아니면 반환값이 여기서 요구하는
// 최소 모양(TargetableMonkey)으로 좁아져서, 부르는 쪽이 kill()·id 를 다시 못 쓴다.
export function findMonkeysInScreenBox<T extends TargetableMonkey>(monkeys: T[], camera: unknown, rect: ScreenRect, radiusPx: number): T[] {
  return monkeys.filter((monkey) => {
    if (monkey.isDying()) return false;
    return isPointInScreenBox(monkey.getCenterWorldPosition(), camera, rect, radiusPx);
  });
}

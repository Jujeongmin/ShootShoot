export function computeBlastRadiusPx(containerHeight, ratio) {
  return containerHeight * ratio;
}

export function isPointInScreenBox(worldPoint, camera, rect, radiusPx) {
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

export function findMonkeysInScreenBox(monkeys, camera, rect, radiusPx) {
  return monkeys.filter((monkey) => {
    if (monkey.isDying()) return false;
    return isPointInScreenBox(monkey.getCenterWorldPosition(), camera, rect, radiusPx);
  });
}

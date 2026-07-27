export function computeBlastRadiusPx(containerHeight, ratio) {
  return containerHeight * ratio;
}

export function findMonkeysInScreenBox(monkeys, camera, rect, radiusPx) {
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  return monkeys.filter((monkey) => {
    if (monkey.isDying()) return false;

    // project()는 벡터를 제자리에서 바꾼다. getWorldPosition()이 매번 새 벡터를
    // 주므로 원숭이 좌표가 오염될 걱정은 없다.
    const ndc = monkey.getWorldPosition().project(camera);
    if (ndc.z > 1) return false; // 카메라 뒤

    const x = rect.left + (ndc.x * 0.5 + 0.5) * rect.width;
    const y = rect.top + (-ndc.y * 0.5 + 0.5) * rect.height;

    return Math.abs(x - centerX) <= radiusPx && Math.abs(y - centerY) <= radiusPx;
  });
}

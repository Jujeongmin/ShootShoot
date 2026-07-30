export function createInputController(domElement) {
  const ndc = { x: 0, y: 0 };
  let aiming = false;
  let enabled = true;
  const downListeners = [];
  const upListeners = [];

  function onMouseMove(event) {
    const rect = domElement.getBoundingClientRect();
    ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function onMouseDown(event) {
    if (!enabled) return;
    if (event.button !== 0) return;
    aiming = true;
    for (const cb of downListeners) cb();
  }

  function onMouseUp(event) {
    if (event.button !== 0) return;
    if (!aiming) return;
    aiming = false;
    for (const cb of upListeners) cb(ndc.x, ndc.y);
  }

  domElement.addEventListener('mousemove', onMouseMove);
  domElement.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  return {
    getNdc: () => ({ ...ndc }),
    isAiming: () => aiming,
    setEnabled(value) {
      // 끌 때는 누르고 있던 조준도 함께 버린다. 안 버리면 버튼을 떼는 순간
      // onMouseUp 이 발사 리스너를 부른다 — 설정을 조준한 채로 열고 떼면 패널이
      // 열려 있는데 총알이 나가던 버그가 이것이다.
      if (!value) aiming = false;
      enabled = value;
    },
    onAimDown(cb) {
      downListeners.push(cb);
    },
    onAimUp(cb) {
      upListeners.push(cb);
    },
    dispose() {
      domElement.removeEventListener('mousemove', onMouseMove);
      domElement.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
    },
  };
}

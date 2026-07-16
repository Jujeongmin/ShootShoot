export function createInputController(domElement) {
  const ndc = { x: 0, y: 0 };
  let aiming = false;
  const downListeners = [];
  const upListeners = [];

  function onMouseMove(event) {
    const rect = domElement.getBoundingClientRect();
    ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function onMouseDown(event) {
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

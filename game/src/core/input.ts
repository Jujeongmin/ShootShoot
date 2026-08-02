export function createInputController(domElement: HTMLElement) {
  const ndc = { x: 0, y: 0 };
  let aiming = false;
  let enabled = true;
  let activePointerId: number | null = null;
  const downListeners: Array<() => void> = [];
  const upListeners: Array<(x: number, y: number) => void> = [];

  function updateNdc(event: Pick<PointerEvent, 'clientX' | 'clientY'>) {
    const rect = domElement.getBoundingClientRect();
    ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function onPointerMove(event: PointerEvent) {
    if (activePointerId !== null && event.pointerId !== activePointerId) return;
    updateNdc(event);
  }

  function onPointerDown(event: PointerEvent) {
    if (!enabled) return;
    if (!event.isPrimary || event.button !== 0 || activePointerId !== null) return;
    event.preventDefault();
    updateNdc(event);
    activePointerId = event.pointerId;
    aiming = true;
    for (const cb of downListeners) cb();
  }

  function finishPointer(event: PointerEvent, fire: boolean) {
    if (event.pointerId !== activePointerId) return;
    event.preventDefault();
    if (fire) updateNdc(event);
    activePointerId = null;
    if (!aiming) return;
    aiming = false;
    if (fire) for (const cb of upListeners) cb(ndc.x, ndc.y);
  }

  function onPointerUp(event: PointerEvent) {
    finishPointer(event, true);
  }

  function onPointerCancel(event: PointerEvent) {
    finishPointer(event, false);
  }

  domElement.addEventListener('pointermove', onPointerMove);
  domElement.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerCancel);

  return {
    getNdc: () => ({ ...ndc }),
    isAiming: () => aiming,
    setEnabled(value: boolean) {
      // 끌 때는 누르고 있던 조준도 함께 버린다. 안 버리면 버튼을 떼는 순간
      // onMouseUp 이 발사 리스너를 부른다 — 설정을 조준한 채로 열고 떼면 패널이
      // 열려 있는데 총알이 나가던 버그가 이것이다.
      if (!value) {
        aiming = false;
        activePointerId = null;
      }
      enabled = value;
    },
    onAimDown(cb: () => void) {
      downListeners.push(cb);
    },
    onAimUp(cb: (x: number, y: number) => void) {
      upListeners.push(cb);
    },
    dispose() {
      domElement.removeEventListener('pointermove', onPointerMove);
      domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
    },
  };
}

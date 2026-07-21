export function createScopeOverlay(container) {
  const ring = document.createElement('div');
  ring.style.cssText = `
    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
    width: 70vmin; height: 70vmin; border-radius: 50%;
    border: 4px solid #000;
    pointer-events: none; display: none; z-index: 12;
  `;
  container.appendChild(ring);

  const reticle = document.createElement('div');
  reticle.style.cssText = `
    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
    width: 70vmin; height: 70vmin; pointer-events: none; display: none; z-index: 13;
  `;
  reticle.innerHTML = `
    <div style="position:absolute; top:0; left:calc(50% - 1px); width:2px; height:38%; background:#000;"></div>
    <div style="position:absolute; bottom:0; left:calc(50% - 1px); width:2px; height:38%; background:#000;"></div>
    <div style="position:absolute; left:0; top:calc(50% - 1px); height:2px; width:38%; background:#000;"></div>
    <div style="position:absolute; right:0; top:calc(50% - 1px); height:2px; width:38%; background:#000;"></div>
    <div style="position:absolute; top:50%; left:50%; width:6px; height:6px; margin:-3px 0 0 -3px; border-radius:50%; background:#f00;"></div>
  `;
  container.appendChild(reticle);

  function show() {
    ring.style.display = 'block';
    reticle.style.display = 'block';
  }

  function hide() {
    ring.style.display = 'none';
    reticle.style.display = 'none';
  }

  return { show, hide };
}

export function createScopeOverlay(container) {
  const vignette = document.createElement('div');
  vignette.style.cssText = `
    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
    width: 70vmin; height: 70vmin; border-radius: 50%;
    box-shadow: 0 0 0 9999px #000;
    pointer-events: none; display: none; z-index: 12;
  `;
  container.appendChild(vignette);

  const reticle = document.createElement('div');
  reticle.style.cssText = `
    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
    width: 24px; height: 24px; pointer-events: none; display: none; z-index: 13;
  `;
  reticle.innerHTML = `
    <div style="position:absolute; top:0; left:11px; width:2px; height:24px; background:#f00;"></div>
    <div style="position:absolute; left:0; top:11px; height:2px; width:24px; background:#f00;"></div>
  `;
  container.appendChild(reticle);

  function show() {
    vignette.style.display = 'block';
    reticle.style.display = 'block';
  }

  function hide() {
    vignette.style.display = 'none';
    reticle.style.display = 'none';
  }

  return { show, hide };
}

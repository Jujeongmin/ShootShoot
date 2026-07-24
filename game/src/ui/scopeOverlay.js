const RETICLE_STYLES = {
  basic: {
    ringVisible: false,
    crosshairColor: '#fff',
    centerColor: '#f00',
    centerShape: 'dot',
  },
  assault: {
    ringVisible: false,
    crosshairColor: '#00e5ff',
    centerColor: '#00e5ff',
    centerShape: 'diamond',
  },
  sniper: {
    ringVisible: true,
    ringShape: 'circle',
    ringBorder: '4px solid #000',
    crosshairColor: '#000',
    centerColor: '#f00',
    centerShape: 'dot',
  },
  raygun: {
    ringVisible: true,
    ringShape: 'hexagon',
    ringBorder: '4px solid #00ff66',
    crosshairColor: '#00ff66',
    centerColor: '#00ff66',
    centerShape: 'dot',
  },
  bazooka: {
    ringVisible: true,
    ringShape: 'circle',
    ringBorder: '5px dashed #ff6600',
    crosshairColor: '#ff6600',
    centerColor: '#ff6600',
    centerShape: 'dot',
  },
};

const DEFAULT_STYLE = RETICLE_STYLES.basic;
const HEXAGON_CLIP_PATH = 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)';

function centerShapeStyle(style) {
  if (style.centerShape === 'diamond') {
    return `width:8px; height:8px; margin:-4px 0 0 -4px; background:${style.centerColor}; transform: rotate(45deg);`;
  }
  return `width:6px; height:6px; margin:-3px 0 0 -3px; border-radius:50%; background:${style.centerColor};`;
}

export function createScopeOverlay(container) {
  const ring = document.createElement('div');
  ring.style.cssText = `
    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
    width: 70vmin; height: 70vmin; box-sizing: border-box;
    pointer-events: none; display: none; z-index: 12;
  `;
  container.appendChild(ring);

  const reticle = document.createElement('div');
  reticle.style.cssText = `
    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
    width: 70vmin; height: 70vmin; pointer-events: none; display: none; z-index: 13;
  `;
  container.appendChild(reticle);

  let currentWeaponId = null;

  function applyStyle(weaponId, style) {
    if (weaponId === currentWeaponId) return;
    currentWeaponId = weaponId;

    ring.style.border = style.ringBorder ?? 'none';
    ring.style.borderRadius = style.ringShape === 'hexagon' ? '0' : '50%';
    ring.style.clipPath = style.ringShape === 'hexagon' ? HEXAGON_CLIP_PATH : 'none';

    reticle.innerHTML = `
      <div style="position:absolute; top:0; left:calc(50% - 1px); width:2px; height:38%; background:${style.crosshairColor};"></div>
      <div style="position:absolute; bottom:0; left:calc(50% - 1px); width:2px; height:38%; background:${style.crosshairColor};"></div>
      <div style="position:absolute; left:0; top:calc(50% - 1px); height:2px; width:38%; background:${style.crosshairColor};"></div>
      <div style="position:absolute; right:0; top:calc(50% - 1px); height:2px; width:38%; background:${style.crosshairColor};"></div>
      <div style="position:absolute; top:50%; left:50%; ${centerShapeStyle(style)}"></div>
    `;
  }

  function show(weaponId) {
    const style = RETICLE_STYLES[weaponId] ?? DEFAULT_STYLE;
    applyStyle(weaponId, style);
    ring.style.display = style.ringVisible ? 'block' : 'none';
    reticle.style.display = 'block';
  }

  function hide() {
    ring.style.display = 'none';
    reticle.style.display = 'none';
  }

  return { show, hide };
}

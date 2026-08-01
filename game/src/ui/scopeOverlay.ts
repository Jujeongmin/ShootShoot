import { TOKENS } from './kit';

// 무기별 조준선 스타일. sniper/raygun만 링을 두르므로 ringShape/ringBorder는
// 선택 필드다.
interface ReticleStyle {
  ringVisible: boolean;
  ringShape?: 'circle' | 'hexagon';
  ringBorder?: string;
  crosshairColor: string;
  centerColor: string;
  centerShape: 'dot' | 'diamond';
}

const RETICLE_STYLES: Record<string, ReticleStyle> = {
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
};

const DEFAULT_STYLE = RETICLE_STYLES.basic;
const HEXAGON_CLIP_PATH = 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)';

const BAZOOKA_ID = 'bazooka';
const BAZOOKA_COLOR = TOKENS.danger;
const BAZOOKA_CORE_COLOR = '#c43a28';
const BRACKET_THICKNESS = 4;

// 십자 팔의 길이. 상자 가장자리에서 안쪽으로 이만큼 온다. 중앙까지는 50%이므로
// 팔 끝과 조준점 사이에 12%가 남는다 — 조준점을 안 가리는 이유다.
const ARM_LENGTH = '38%';
const TICK_LENGTH = 10;
const TICK_THICKNESS = 2;

// 밝은 하늘 위에서 흰 조준선(basic)이 사라진다. box-shadow 는 레이아웃을 안 바꾸므로
// 조준선 치수가 그대로다 — 판정에 쓰이는 크기를 건드리면 안 된다.
const RETICLE_OUTLINE = '0 0 0 1px rgba(0, 0, 0, 0.55)';

function centerShapeStyle(style: ReticleStyle) {
  if (style.centerShape === 'diamond') {
    return `width:8px; height:8px; margin:-4px 0 0 -4px; background:${style.centerColor}; transform: rotate(45deg);`;
  }
  return `width:6px; height:6px; margin:-3px 0 0 -3px; border-radius:50%; background:${style.centerColor};`;
}

function crosshairHtml(style: ReticleStyle) {
  const bar = `position:absolute; background:${style.crosshairColor}; box-shadow:${RETICLE_OUTLINE};`;
  const t = TICK_THICKNESS;
  const half = TICK_LENGTH / 2;
  // 눈금은 팔의 안쪽 끝에 붙는다. 바깥쪽 끝은 70vmin 상자의 가장자리라 화면 구석이고
  // 거기 달면 안 보인다. 안쪽에 달면 조준점을 네 개의 T자가 감싸는 거리계가 된다.
  return `
    <div style="${bar} top:0; left:calc(50% - 1px); width:2px; height:${ARM_LENGTH};"></div>
    <div style="${bar} bottom:0; left:calc(50% - 1px); width:2px; height:${ARM_LENGTH};"></div>
    <div style="${bar} left:0; top:calc(50% - 1px); height:2px; width:${ARM_LENGTH};"></div>
    <div style="${bar} right:0; top:calc(50% - 1px); height:2px; width:${ARM_LENGTH};"></div>
    <div style="${bar} top:calc(${ARM_LENGTH} - ${t}px); left:calc(50% - ${half}px); width:${TICK_LENGTH}px; height:${t}px;"></div>
    <div style="${bar} bottom:calc(${ARM_LENGTH} - ${t}px); left:calc(50% - ${half}px); width:${TICK_LENGTH}px; height:${t}px;"></div>
    <div style="${bar} left:calc(${ARM_LENGTH} - ${t}px); top:calc(50% - ${half}px); height:${TICK_LENGTH}px; width:${t}px;"></div>
    <div style="${bar} right:calc(${ARM_LENGTH} - ${t}px); top:calc(50% - ${half}px); height:${TICK_LENGTH}px; width:${t}px;"></div>
    <div style="position:absolute; top:50%; left:50%; box-shadow:${RETICLE_OUTLINE}; ${centerShapeStyle(style)}"></div>
  `;
}

// 판정에 쓰이는 정사각형(반경 radiusPx)을 그대로 그린다. 네 모서리 브래킷이
// 사각형의 경계이고, 그 안에 들어온 원숭이가 죽는다.
export function bazookaReticleHtml(radiusPx: number) {
  const r = radiusPx;
  const arm = r * 0.42;
  const tickLength = r * 0.22;
  const tickOffset = r * 0.45;
  const outer = r * 0.16;
  const inner = r * 0.08;
  const t = BRACKET_THICKNESS;
  const bar = `position:absolute; background:${BAZOOKA_COLOR}; box-shadow:${RETICLE_OUTLINE};`;

  const corners = [
    ['top:0; left:0;', `width:${arm}px; height:${t}px;`, `width:${t}px; height:${arm}px;`],
    ['top:0; right:0;', `width:${arm}px; height:${t}px;`, `width:${t}px; height:${arm}px;`],
    ['bottom:0; left:0;', `width:${arm}px; height:${t}px;`, `width:${t}px; height:${arm}px;`],
    ['bottom:0; right:0;', `width:${arm}px; height:${t}px;`, `width:${t}px; height:${arm}px;`],
  ]
    .map(([anchor, horizontal, vertical]) =>
      `<div style="${bar} ${anchor} ${horizontal}"></div><div style="${bar} ${anchor} ${vertical}"></div>`
    )
    .join('');

  const ticks = [
    `${bar} left:${r - t / 2}px; top:${r - tickOffset - tickLength}px; width:${t}px; height:${tickLength}px;`,
    `${bar} left:${r - t / 2}px; top:${r + tickOffset}px; width:${t}px; height:${tickLength}px;`,
    `${bar} top:${r - t / 2}px; left:${r - tickOffset - tickLength}px; height:${t}px; width:${tickLength}px;`,
    `${bar} top:${r - t / 2}px; left:${r + tickOffset}px; height:${t}px; width:${tickLength}px;`,
  ]
    .map((style) => `<div style="${style}"></div>`)
    .join('');

  const core = `
    <div style="position:absolute; left:${r - outer}px; top:${r - outer}px; width:${outer * 2}px; height:${outer * 2}px; border-radius:50%; background:${BAZOOKA_COLOR}; box-shadow:${RETICLE_OUTLINE};"></div>
    <div style="position:absolute; left:${r - inner}px; top:${r - inner}px; width:${inner * 2}px; height:${inner * 2}px; border-radius:50%; background:${BAZOOKA_CORE_COLOR};"></div>
  `;

  return corners + ticks + core;
}

export function createScopeOverlay(container: HTMLElement) {
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

  let currentKey: string | null = null;

  function applyBazooka(radiusPx: number) {
    ring.style.border = 'none';
    ring.style.clipPath = 'none';
    reticle.style.width = `${radiusPx * 2}px`;
    reticle.style.height = `${radiusPx * 2}px`;
    reticle.innerHTML = bazookaReticleHtml(radiusPx);
  }

  function applyStandard(style: ReticleStyle) {
    ring.style.border = style.ringBorder ?? 'none';
    ring.style.borderRadius = style.ringShape === 'hexagon' ? '0' : '50%';
    ring.style.clipPath = style.ringShape === 'hexagon' ? HEXAGON_CLIP_PATH : 'none';
    reticle.style.width = '70vmin';
    reticle.style.height = '70vmin';
    reticle.innerHTML = crosshairHtml(style);
  }

  function show(weaponId: string, blastRadiusPx: number = 0) {
    const isBazooka = weaponId === BAZOOKA_ID;
    // 창 크기가 바뀌면 반경도 바뀌므로 캐시 키에 포함한다.
    const key = isBazooka ? `${weaponId}:${blastRadiusPx}` : weaponId;

    if (key !== currentKey) {
      currentKey = key;
      if (isBazooka) {
        applyBazooka(blastRadiusPx);
      } else {
        applyStandard(RETICLE_STYLES[weaponId] ?? DEFAULT_STYLE);
      }
    }

    ring.style.display = !isBazooka && (RETICLE_STYLES[weaponId] ?? DEFAULT_STYLE).ringVisible
      ? 'block'
      : 'none';
    reticle.style.display = 'block';
  }

  function hide() {
    ring.style.display = 'none';
    reticle.style.display = 'none';
  }

  return { show, hide };
}

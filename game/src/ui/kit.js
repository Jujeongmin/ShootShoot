// theme.css의 CSS 변수와 값이 같아야 한다. 한쪽만 바꾸면 어긋난다.
export const TOKENS = {
  face: '#ffcc00',
  hi: '#ffea9c',
  shadow: '#dea312',
  deep: '#b48000',
  grey: '#dadce7',
  greyShadow: '#989aaf',
  white: '#ffffff',
  ink: '#1a1a2e',
  inkSoft: '#4a4a5e',
  danger: '#e4503a',
};

const TONES = ['white', 'black'];

// Kenney 아이콘은 White/Black 두 벌이다. 회색 패널 위의 흰 아이콘은 안 보이므로
// 밝은 면에는 black, 어두운 스크림 위에는 white를 쓴다.
export function iconUrl(name, tone) {
  if (typeof name !== 'string' || name.length === 0) {
    throw new Error('iconUrl: name must be a non-empty string');
  }
  if (!TONES.includes(tone)) {
    throw new Error(`iconUrl: tone must be one of ${TONES.join(', ')}`);
  }
  return `/icons/${tone}/${name}.png`;
}

// 상점 화살표처럼 kenney_ui-pack 쪽에 있는 스프라이트는 /icons/{tone}/ 규칙에
// 맞지 않는다. 슬래시로 시작하면 이미 경로이므로 그대로 통과시킨다.
export function resolveIconSrc(icon, tone) {
  return icon.startsWith('/') ? icon : iconUrl(icon, tone);
}

const BUTTON_VARIANT_CLASS = {
  primary: '',
  ghost: 'k-btn--ghost',
  off: 'k-btn--off',
};

export function scrim() {
  const el = document.createElement('div');
  el.className = 'k-scrim';
  el.style.display = 'none';
  return el;
}

export function panel() {
  const el = document.createElement('div');
  el.className = 'k-panel';
  return el;
}

export function title(text) {
  const el = document.createElement('div');
  el.className = 'k-title';
  el.textContent = text;
  return el;
}

export function num(text) {
  const el = document.createElement('span');
  el.className = 'k-num';
  el.textContent = text;
  return el;
}

export function divider() {
  const el = document.createElement('div');
  el.className = 'k-divider';
  return el;
}

// variant가 'off'면 클릭이 아무 일도 하지 않아야 한다. 핸들러를 붙이지 않고
// disabled까지 세워 둔다.
export function button(label, onClick, variant = 'primary') {
  const variantClass = BUTTON_VARIANT_CLASS[variant];
  if (variantClass === undefined) {
    throw new Error(`button: unknown variant ${variant}`);
  }
  const el = document.createElement('button');
  el.className = variantClass ? `k-btn ${variantClass}` : 'k-btn';
  el.textContent = label;
  if (variant === 'off') {
    el.disabled = true;
  } else {
    if (typeof onClick !== 'function') {
      throw new Error('button: onClick must be a function');
    }
    el.addEventListener('click', onClick);
  }
  return el;
}

export function iconButton(icon, alt, onClick, size, opts = {}) {
  const { round = false, tone = 'black' } = opts;
  if (typeof onClick !== 'function') {
    throw new Error('iconButton: onClick must be a function');
  }
  const el = document.createElement('button');
  el.className = round ? 'k-icon-btn k-icon-btn--round' : 'k-icon-btn';
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.title = alt;
  const img = document.createElement('img');
  img.src = resolveIconSrc(icon, tone);
  img.alt = alt;
  el.appendChild(img);
  el.addEventListener('click', onClick);
  return el;
}

export function badge(text, opts = {}) {
  const { icon, tone = 'black' } = opts;
  const el = document.createElement('div');
  el.className = 'k-badge';
  if (icon) {
    const img = document.createElement('img');
    img.src = resolveIconSrc(icon, tone);
    img.alt = '';
    img.style.width = '16px';
    img.style.height = '16px';
    el.appendChild(img);
  }
  const span = document.createElement('span');
  span.className = 'k-num';
  span.textContent = text;
  el.appendChild(span);
  return el;
}

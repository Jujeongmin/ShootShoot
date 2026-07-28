import { scrim, panel, button, iconButton, badge, divider, title } from './kit.js';
import { weaponButtonState } from './weaponButtonState.js';

const MAX_DAMAGE_PIPS = 5;

export function createShopPanel(container) {
  const overlay = scrim();
  overlay.style.zIndex = '25';
  container.appendChild(overlay);

  let index = 0;
  let current = null;

  // 데미지를 별 5개로 표시한다. 채운 별과 빈 별 스프라이트가 따로 있다.
  function damagePips(damage) {
    const row = document.createElement('div');
    row.style.cssText = 'display: flex; justify-content: center; gap: 3px; margin-top: 6px;';
    const filled = Math.min(damage, MAX_DAMAGE_PIPS);
    for (let i = 0; i < MAX_DAMAGE_PIPS; i += 1) {
      const star = document.createElement('img');
      star.src = i < filled ? '/ui/star.png' : '/ui/star-empty.png';
      star.alt = '';
      star.style.cssText = 'width: 20px; height: 19px;';
      row.appendChild(star);
    }
    return row;
  }

  function actionButton(weapon, gold, handlers) {
    const state = weaponButtonState(weapon, gold);
    let el;
    if (state === 'equipped') {
      el = button('장착 중', () => {}, 'off');
    } else if (state === 'equip') {
      el = button('장착하기', () => handlers.onEquip(weapon.id), 'ghost');
    } else if (state === 'buy') {
      el = button(`🪙 ${weapon.price.toLocaleString()} 구매`, () => handlers.onBuy(weapon.id), 'primary');
    } else {
      el = button(`🪙 ${weapon.price.toLocaleString()} · 골드 부족`, () => {}, 'off');
    }
    el.style.cssText += 'width: 100%; margin-top: 12px;';
    return el;
  }

  function render() {
    const { gold, weapons, error } = current.state;
    const handlers = current.handlers;
    const weapon = weapons[index];
    overlay.innerHTML = '';

    const box = panel();
    box.style.cssText = 'width: min(420px, 88%);';
    overlay.appendChild(box);

    const bar = document.createElement('div');
    bar.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';
    bar.appendChild(title('무기 상점'));
    bar.appendChild(badge(`🪙 ${gold.toLocaleString()}`));
    box.appendChild(bar);
    box.appendChild(divider());

    const row = document.createElement('div');
    row.style.cssText = 'display: flex; align-items: center; gap: 10px;';

    const prev = iconButton('/ui/arrow-w.png', '이전', () => { index -= 1; render(); }, 44, { round: true });
    prev.disabled = index === 0;
    row.appendChild(prev);

    const card = document.createElement('div');
    card.style.cssText = 'flex: 1; text-align: center;';

    // 무기 그림은 tools/crop-weapon-art.mjs 로 투명 여백을 잘라 둔 상태라
    // contain 이 그림 자체에 맞는다. 여백이 다시 붙은 그림을 넣으면 작아진다.
    const frame = document.createElement('div');
    frame.className = 'k-badge';
    frame.style.cssText = `
      display: flex; align-items: center; justify-content: center;
      height: 140px; width: 100%; box-sizing: border-box; padding: 6px;
    `;
    const img = document.createElement('img');
    img.src = weapon.image;
    img.alt = weapon.name;
    img.style.cssText = 'max-width: 100%; max-height: 100%; object-fit: contain;';
    frame.appendChild(img);
    card.appendChild(frame);

    const name = document.createElement('div');
    name.textContent = weapon.name;
    name.style.cssText = 'font-size: 19px; font-weight: bold; color: #1a1a2e; margin-top: 10px;';
    card.appendChild(name);
    card.appendChild(damagePips(weapon.damage));
    card.appendChild(actionButton(weapon, gold, handlers));

    if (typeof error === 'string' && error.length > 0) {
      const errorText = document.createElement('div');
      errorText.style.cssText = 'color: #e4503a; font-size: 12px; margin-top: 8px;';
      errorText.textContent = error;
      card.appendChild(errorText);
    }

    row.appendChild(card);

    const next = iconButton('/ui/arrow-e.png', '다음', () => { index += 1; render(); }, 44, { round: true });
    next.disabled = index === weapons.length - 1;
    row.appendChild(next);

    box.appendChild(row);

    const dots = document.createElement('div');
    dots.style.cssText = 'display: flex; justify-content: center; gap: 6px; margin-top: 14px;';
    weapons.forEach((_, i) => {
      const dot = document.createElement('span');
      dot.style.cssText = `
        display: inline-block; height: 8px; border-radius: 4px;
        width: ${i === index ? '20px' : '8px'};
        background: ${i === index ? '#ffcc00' : '#989aaf'};
      `;
      dots.appendChild(dot);
    });
    box.appendChild(dots);

    const closeBtn = button('닫기', handlers.onClose, 'ghost');
    closeBtn.style.cssText += 'display: block; margin: 14px auto 0;';
    box.appendChild(closeBtn);
  }

  function show(state, handlers) {
    current = { state, handlers };
    if (index >= state.weapons.length) index = 0;
    render();
    overlay.style.display = 'flex';
  }

  function hide() {
    overlay.style.display = 'none';
  }

  return { show, hide };
}

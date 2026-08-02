import { scrim, panel, button, iconButton, badge, divider, title, TOKENS } from './kit';
import { weaponButtonState } from './weaponButtonState';
import type { Weapon } from '../config';

const MAX_DAMAGE_PIPS = 5;

// game.ts의 buildShopState()가 CONFIG.weapons에서 이 다섯 필드만 골라
// owned/equipped를 붙여 보낸다 — 전체 Weapon(모델 경로, scale 등)은 상점
// 카드에 필요 없다.
type ShopWeapon = Pick<Weapon, 'id' | 'name' | 'image' | 'damage' | 'price'> & {
  owned: boolean;
  equipped: boolean;
};

interface ShopState {
  gold: number;
  adGoldAmount: number;
  weapons: ShopWeapon[];
  error: string | null;
}

interface ShopHandlers {
  onWatchAdGold: () => void;
  onEquip: (id: string) => void;
  onBuy: (id: string) => void;
  onClose: () => void;
}

export function createShopPanel(container: HTMLElement) {
  const overlay = scrim();
  overlay.style.zIndex = '25';
  container.appendChild(overlay);

  let index = 0;
  let current: { state: ShopState; handlers: ShopHandlers } | null = null;

  // 데미지를 별 5개로 표시한다. 채운 별과 빈 별 스프라이트가 따로 있다.
  function damagePips(damage: number) {
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

  // 골드가 모자랄 때만 가격 옆에 광고 버튼이 붙는다. 나머지 상태는 버튼 하나다.
  // 광고가 얼마를 주는지는 버튼에 적는다 — 금액은 game.ts 가 state 로 넘긴다.
  function insufficientRow(weapon: ShopWeapon, adGoldAmount: number, handlers: ShopHandlers) {
    const row = document.createElement('div');
    row.style.cssText = 'display: flex; align-items: stretch; gap: 8px; margin-top: 12px;';

    const price = button(`🪙 ${weapon.price.toLocaleString()}`, () => {}, 'off');
    price.style.flex = '1';
    row.appendChild(price);

    const watch = button(`📺 +${adGoldAmount.toLocaleString()}`, handlers.onWatchAdGold, 'ghost');
    watch.style.flex = 'none';
    row.appendChild(watch);

    return row;
  }

  function actionButton(weapon: ShopWeapon, gold: number, adGoldAmount: number, handlers: ShopHandlers) {
    const state = weaponButtonState(weapon, gold);
    if (state === 'insufficient') {
      return insufficientRow(weapon, adGoldAmount, handlers);
    }

    let el;
    if (state === 'equipped') {
      el = button('Equipped', () => {}, 'off');
    } else if (state === 'equip') {
      el = button('Equip', () => handlers.onEquip(weapon.id), 'ghost');
    } else {
      el = button(`🪙 ${weapon.price.toLocaleString()} Buy`, () => handlers.onBuy(weapon.id), 'primary');
    }
    el.style.cssText += 'width: 100%; margin-top: 12px;';
    return el;
  }

  function render() {
    // render()는 항상 show()가 current를 채운 뒤에만 불린다(초기 호출도, prev/next의
    // 재귀 호출도). 그 순서를 타입에는 담을 수 없어 단언으로 남긴다.
    const { state, handlers } = current!;
    const { gold, adGoldAmount, weapons, error } = state;
    const weapon = weapons[index];
    overlay.innerHTML = '';

    const box = panel();
    box.style.cssText = 'width: min(420px, 88%);';
    overlay.appendChild(box);

    const bar = document.createElement('div');
    bar.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';
    bar.appendChild(title('Weapon shop'));
    bar.appendChild(badge(`🪙 ${gold.toLocaleString()}`));
    box.appendChild(bar);
    box.appendChild(divider());

    const row = document.createElement('div');
    row.style.cssText = 'display: flex; align-items: center; gap: 10px;';

    const prev = iconButton('/ui/arrow-w.png', 'Prev', () => { index -= 1; render(); }, 44, { round: true });
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
    // 무기 그림이 아직 없을 수 있다. 깨진 이미지 아이콘 대신 자리만 비운다.
    // screens.ts 의 artwork() 와 같은 처리다.
    img.addEventListener('error', () => { img.style.visibility = 'hidden'; });
    frame.appendChild(img);
    card.appendChild(frame);

    const name = document.createElement('div');
    name.textContent = weapon.name;
    name.style.cssText = `font-size: 19px; font-weight: bold; color: ${TOKENS.ink}; margin-top: 10px;`;
    card.appendChild(name);
    card.appendChild(damagePips(weapon.damage));
    card.appendChild(actionButton(weapon, gold, adGoldAmount, handlers));

    if (typeof error === 'string' && error.length > 0) {
      const errorText = document.createElement('div');
      errorText.style.cssText = `color: ${TOKENS.danger}; font-size: 12px; margin-top: 8px;`;
      errorText.textContent = error;
      card.appendChild(errorText);
    }

    row.appendChild(card);

    const next = iconButton('/ui/arrow-e.png', 'Next', () => { index += 1; render(); }, 44, { round: true });
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
        background: ${i === index ? TOKENS.face : TOKENS.greyShadow};
      `;
      dots.appendChild(dot);
    });
    box.appendChild(dots);

    const closeBtn = button('Close', handlers.onClose, 'ghost');
    closeBtn.style.cssText += 'display: block; margin: 14px auto 0;';
    box.appendChild(closeBtn);
  }

  function show(state: ShopState, handlers: ShopHandlers) {
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

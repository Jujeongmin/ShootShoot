const MAX_DAMAGE_PIPS = 5;

export function createShopPanel(container) {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: absolute; inset: 0; display: none; flex-direction: column;
    align-items: center; justify-content: center; color: #fff;
    font-family: sans-serif; background: rgba(0,0,0,0.7); z-index: 25;
  `;
  container.appendChild(overlay);

  let index = 0;
  let current = null;

  function damagePips(damage) {
    const filled = Math.min(damage, MAX_DAMAGE_PIPS);
    return `<span style="color:#f0a500;letter-spacing:2px">${'●'.repeat(filled)}<span style="color:#555">${'●'.repeat(MAX_DAMAGE_PIPS - filled)}</span></span>`;
  }

  function actionButton(weapon, gold, handlers) {
    const btn = document.createElement('button');
    const base = `
      width: 100%; border: none; border-radius: 6px; padding: 10px 0;
      font-size: 15px; font-weight: bold; margin-top: 12px;
    `;

    if (weapon.equipped) {
      btn.textContent = '장착 중';
      btn.style.cssText = `${base} background: #3a3a45; color: #888; cursor: default;`;
      btn.disabled = true;
    } else if (weapon.owned) {
      btn.textContent = '장착하기';
      btn.style.cssText = `${base} background: transparent; border: 1px solid #7ec8e3; color: #7ec8e3; cursor: pointer;`;
      btn.addEventListener('click', () => handlers.onEquip(weapon.id));
    } else if (gold >= weapon.price) {
      btn.textContent = `🪙 ${weapon.price.toLocaleString()} 구매`;
      btn.style.cssText = `${base} background: #f0a500; color: #1a1a2e; cursor: pointer;`;
      btn.addEventListener('click', () => handlers.onBuy(weapon.id));
    } else {
      btn.textContent = `🪙 ${weapon.price.toLocaleString()} · 골드 부족`;
      btn.style.cssText = `${base} background: #3a3a45; color: #888; cursor: default;`;
      btn.disabled = true;
    }
    return btn;
  }

  function arrow(label, disabled, onClick) {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText = `
      width: 44px; height: 44px; flex: none; border-radius: 50%; font-size: 18px;
      background: rgba(255,255,255,0.08); border: 1px solid #555; color: #fff;
      cursor: ${disabled ? 'default' : 'pointer'}; opacity: ${disabled ? 0.3 : 1};
    `;
    btn.disabled = disabled;
    if (!disabled) btn.addEventListener('click', onClick);
    return btn;
  }

  function render() {
    const { gold, weapons } = current.state;
    const handlers = current.handlers;
    const weapon = weapons[index];
    overlay.innerHTML = '';

    const panel = document.createElement('div');
    panel.style.cssText = 'width: min(420px, 88%); background: #14141f; border-radius: 12px; padding: 18px;';
    overlay.appendChild(panel);

    const bar = document.createElement('div');
    bar.style.cssText = `
      display: flex; justify-content: space-between; align-items: center;
      border-bottom: 1px solid #333; padding-bottom: 10px; margin-bottom: 16px;
    `;
    bar.innerHTML = `
      <b style="font-size:17px">무기 상점</b>
      <span style="background:rgba(240,165,0,0.15);border:1px solid #f0a500;color:#f0a500;
                   border-radius:20px;padding:4px 14px;font-size:14px;font-weight:bold">
        🪙 ${gold.toLocaleString()}
      </span>
    `;
    panel.appendChild(bar);

    const row = document.createElement('div');
    row.style.cssText = 'display: flex; align-items: center; gap: 10px;';
    row.appendChild(arrow('◀', index === 0, () => { index -= 1; render(); }));

    const card = document.createElement('div');
    const accent = weapon.equipped ? '#f0a500' : weapon.owned ? '#7ec8e3' : '#555';
    card.style.cssText = `
      flex: 1; border: 2px solid ${accent}; border-radius: 10px; padding: 16px; text-align: center;
      background: rgba(255,255,255,0.04);
    `;
    card.innerHTML = `
      <div style="height:120px;border-radius:8px;background:rgba(0,0,0,0.35);
                  display:flex;align-items:center;justify-content:center;margin-bottom:12px">
        <img src="${weapon.image}" alt="${weapon.name}" style="max-width:90%;max-height:100%">
      </div>
      <div style="font-size:19px;font-weight:bold;margin-bottom:6px">${weapon.name}</div>
      <div style="font-size:13px;color:#bbb">데미지 ${damagePips(weapon.damage)}</div>
    `;
    card.appendChild(actionButton(weapon, gold, handlers));
    row.appendChild(card);

    row.appendChild(arrow('▶', index === weapons.length - 1, () => { index += 1; render(); }));
    panel.appendChild(row);

    const dots = document.createElement('div');
    dots.style.cssText = 'text-align: center; margin-top: 14px;';
    dots.innerHTML = weapons
      .map((_, i) => `<span style="display:inline-block;height:8px;margin:0 4px;border-radius:4px;
        width:${i === index ? '20px' : '8px'};background:${i === index ? '#f0a500' : '#555'}"></span>`)
      .join('');
    panel.appendChild(dots);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '닫기';
    closeBtn.style.cssText = `
      display: block; margin: 14px auto 0; padding: 8px 28px; font-size: 14px; cursor: pointer;
      border: 1px solid #f0a500; border-radius: 6px; background: transparent; color: #f0a500;
    `;
    closeBtn.addEventListener('click', handlers.onClose);
    panel.appendChild(closeBtn);
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

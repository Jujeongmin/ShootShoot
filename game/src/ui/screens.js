export function createScreens(container) {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: absolute; inset: 0; display: flex; flex-direction: column;
    align-items: center; justify-content: center; color: #fff;
    font-family: sans-serif; background: rgba(0,0,0,0.55); z-index: 20;
  `;
  container.appendChild(overlay);
  hide();

  function clear() {
    overlay.innerHTML = '';
  }

  function show() {
    overlay.style.display = 'flex';
  }

  function hide() {
    overlay.style.display = 'none';
  }

  function button(label, onClick) {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText = `
      margin-top: 16px; padding: 10px 24px; font-size: 18px; cursor: pointer;
      border: none; border-radius: 6px; background: #f0a500; color: #1a1a2e;
    `;
    btn.addEventListener('click', onClick);
    return btn;
  }

  function iconButton(imageSrc, alt, onClick, size) {
    const btn = document.createElement('button');
    btn.style.cssText = `
      width: ${size}px; height: ${size}px; padding: ${size * 0.22}px; cursor: pointer;
      border: none; border-radius: 50%; background: rgba(240,165,0,0.85);
      display: flex; align-items: center; justify-content: center;
    `;
    const img = document.createElement('img');
    img.src = imageSrc;
    img.alt = alt;
    img.style.cssText = 'width: 100%; height: 100%; object-fit: contain;';
    btn.appendChild(img);
    btn.addEventListener('click', onClick);
    return btn;
  }

  function upgradeCard(title, level, cost, canAfford, onUpgrade, onWatchAd, side) {
    const card = document.createElement('div');
    card.style.cssText = `
      position: absolute; bottom: 20px; ${side}: 20px; width: 128px;
      background: rgba(0,0,0,0.45); border: 1px solid #f0a500; border-radius: 10px;
      padding: 10px; text-align: center;
    `;

    const titleEl = document.createElement('div');
    titleEl.textContent = title;
    titleEl.style.cssText = 'font-size: 13px; font-weight: bold; color: #f0a500;';
    card.appendChild(titleEl);

    const levelEl = document.createElement('div');
    levelEl.textContent = `Lv.${level}`;
    levelEl.style.cssText = 'font-size: 12px; color: #ccc; margin: 4px 0 8px;';
    card.appendChild(levelEl);

    const actionBtn = document.createElement('button');
    actionBtn.style.cssText = `
      width: 100%; border: none; border-radius: 6px; padding: 6px 0;
      font-size: 12px; font-weight: bold; cursor: pointer;
    `;
    if (canAfford) {
      actionBtn.textContent = `🪙 ${cost.toLocaleString()} 강화`;
      actionBtn.style.background = '#f0a500';
      actionBtn.style.color = '#1a1a2e';
      actionBtn.addEventListener('click', onUpgrade);
    } else {
      actionBtn.textContent = '📺 무료강화';
      actionBtn.style.background = 'transparent';
      actionBtn.style.border = '1px solid #7ec8e3';
      actionBtn.style.color = '#7ec8e3';
      actionBtn.addEventListener('click', onWatchAd);
    }
    card.appendChild(actionBtn);

    return card;
  }

  function showMenu(state, handlers) {
    const { gold, damageLevel, damageCost, canAffordDamage, offlineLevel, offlineCost, canAffordOffline } = state;
    clear();

    // 좌측 중앙: 상점 아이콘
    const shopBtn = iconButton('/icons/cart.png', '상점', handlers.onShop, 56);
    shopBtn.style.position = 'absolute';
    shopBtn.style.left = '20px';
    shopBtn.style.top = '50%';
    shopBtn.style.transform = 'translateY(-50%)';
    overlay.appendChild(shopBtn);

    // 우측 상단: 보유 골드 + 광고보상 + 설정 아이콘
    const topRight = document.createElement('div');
    topRight.style.cssText = `
      position: absolute; top: 16px; right: 16px;
      display: flex; align-items: center; gap: 10px;
    `;
    const goldBadge = document.createElement('div');
    goldBadge.style.cssText = `
      display: flex; align-items: center; gap: 4px;
      background: rgba(0,0,0,0.35); border: 1px solid #f0a500; border-radius: 20px;
      padding: 6px 14px; font-size: 15px; font-weight: bold; color: #f0a500;
    `;
    goldBadge.textContent = `🪙 ${gold}`;
    topRight.appendChild(goldBadge);
    topRight.appendChild(iconButton('/icons/video.png', '광고 보상', handlers.onAdReward, 40));
    topRight.appendChild(iconButton('/icons/gear.png', '설정', handlers.onSettings, 40));
    overlay.appendChild(topRight);

    const title = document.createElement('h1');
    title.textContent = '🐒 ShootShoot';
    overlay.appendChild(title);
    const subtitle = document.createElement('p');
    subtitle.textContent = '클릭하여 조준, 놓아서 발사!';
    overlay.appendChild(subtitle);
    overlay.appendChild(button('탭하여 시작', handlers.onStart));

    // 좌하단: 공격력 강화, 우하단: 오프라인 강화
    overlay.appendChild(
      upgradeCard('공격력', damageLevel, damageCost, canAffordDamage, handlers.onLevelUpDamage, handlers.onWatchAdDamage, 'left')
    );
    overlay.appendChild(
      upgradeCard('오프라인', offlineLevel, offlineCost, canAffordOffline, handlers.onLevelUpOffline, handlers.onWatchAdOffline, 'right')
    );

    show();
  }

  function showGameOver({ score, highScore, isNewHighScore }, onReturnToMenu) {
    clear();
    const title = document.createElement('h1');
    title.textContent = '게임 종료';
    overlay.appendChild(title);
    const scoreEl = document.createElement('p');
    scoreEl.textContent = `점수: ${score}`;
    overlay.appendChild(scoreEl);
    const highScoreEl = document.createElement('p');
    highScoreEl.textContent = isNewHighScore ? `🎉 신기록! 최고점수: ${highScore}` : `최고점수: ${highScore}`;
    overlay.appendChild(highScoreEl);
    overlay.appendChild(button('메인 메뉴로', onReturnToMenu));
    show();
  }

  function showLoading(text) {
    clear();
    const p = document.createElement('p');
    p.textContent = text;
    overlay.appendChild(p);
    show();
  }

  return { showMenu, showGameOver, showLoading, hide, dispose: () => overlay.remove() };
}

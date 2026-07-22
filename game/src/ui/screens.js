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

  function showMenu(onStart, onSettings, onShop, onAdReward, gold) {
    clear();
    const title = document.createElement('h1');
    title.textContent = '🐒 ShootShoot';
    overlay.appendChild(title);
    const subtitle = document.createElement('p');
    subtitle.textContent = '클릭하여 조준, 놓아서 발사!';
    overlay.appendChild(subtitle);
    const goldEl = document.createElement('p');
    goldEl.textContent = `보유 골드: ${gold}`;
    overlay.appendChild(goldEl);
    overlay.appendChild(button('탭하여 시작', onStart));
    overlay.appendChild(button('설정', onSettings));
    overlay.appendChild(button('상점', onShop));
    overlay.appendChild(button('광고 보상', onAdReward));
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

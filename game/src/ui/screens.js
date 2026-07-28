import { scrim, panel, button, iconButton, badge, divider, title, num, iconUrl } from './kit.js';

const BAZOOKA_MAX_ROUNDS = 5;
// game/thumb.html 로 뽑는다. 아직 없어도 카드는 뜨고 그림 자리만 비운다.
const BAZOOKA_IMAGE = '/images/weapons/bazooka.png';

export function createScreens(container) {
  const overlay = scrim();
  overlay.style.zIndex = '20';
  container.appendChild(overlay);

  function clear() {
    overlay.innerHTML = '';
  }

  function show() {
    overlay.style.display = 'flex';
  }

  function hide() {
    overlay.style.display = 'none';
  }

  // 상단 바: 좌측 로고, 우측 골드 배지 + 아이콘 버튼 3개.
  function topBar(gold, handlers) {
    const bar = document.createElement('div');
    bar.style.cssText = `
      position: absolute; top: 16px; left: 20px; right: 20px;
      display: flex; align-items: center; justify-content: space-between;
    `;

    const logo = document.createElement('div');
    logo.textContent = 'SHOOTSHOOT';
    logo.style.cssText = `
      font-family: 'Kenney Future', sans-serif; font-size: 22px; letter-spacing: 2px;
      color: #ffcc00; text-shadow: 0 2px 0 #b48000;
    `;
    bar.appendChild(logo);

    const right = document.createElement('div');
    right.style.cssText = 'display: flex; align-items: center; gap: 10px;';
    right.appendChild(badge(`🪙 ${gold.toLocaleString()}`));
    right.appendChild(iconButton('video', '광고 보상', handlers.onAdReward, 44));
    right.appendChild(iconButton('gear', '설정', handlers.onSettings, 44));
    bar.appendChild(right);

    return bar;
  }

  // 메뉴의 카드는 전부 이 틀을 쓴다. anchorCss 로 화면 어디에 붙을지만 달라진다.
  function menuCard(anchorCss, width, headingText, bodyNodes, actionNode) {
    const card = panel();
    card.style.cssText = `${anchorCss} width: ${width}px; text-align: center;`;
    card.appendChild(title(headingText));
    for (const node of bodyNodes) card.appendChild(node);
    actionNode.style.width = '100%';
    card.appendChild(actionNode);
    return card;
  }

  // 그림이 아직 없을 수 있다. 깨진 이미지 아이콘 대신 자리만 비운다.
  function artwork(src, alt, height) {
    const frame = document.createElement('div');
    frame.style.cssText = `
      display: flex; align-items: center; justify-content: center;
      height: ${height}px; margin: 4px 0 10px;
    `;
    const img = document.createElement('img');
    img.src = src;
    img.alt = alt;
    img.style.cssText = 'max-width: 100%; max-height: 100%; object-fit: contain;';
    img.addEventListener('error', () => { img.style.visibility = 'hidden'; });
    frame.appendChild(img);
    return frame;
  }

  function levelLine(level) {
    const line = document.createElement('div');
    line.style.cssText = 'color: #4a4a5e; font-size: 15px; margin-bottom: 12px;';
    line.appendChild(document.createTextNode('Lv.'));
    line.appendChild(num(String(level)));
    return line;
  }

  function roundsLine(rounds) {
    const line = document.createElement('div');
    line.style.cssText = 'color: #4a4a5e; font-size: 15px; margin-bottom: 12px;';
    line.appendChild(num(`${rounds}/${BAZOOKA_MAX_ROUNDS}`));
    return line;
  }

  // 좌하단 / 우하단
  function upgradeCard(anchorCss, headingText, level, cost, canAfford, onUpgrade, onWatchAd) {
    const action = canAfford
      ? button(`🪙 ${cost.toLocaleString()} 강화`, onUpgrade, 'primary')
      : button('📺 무료강화', onWatchAd, 'ghost');
    return menuCard(anchorCss, 240, headingText, [levelLine(level)], action);
  }

  // 좌측 중앙
  function shopCard(onShop) {
    const anchor = 'position: absolute; left: 24px; top: 50%; transform: translateY(-50%);';
    const art = artwork(iconUrl('cart', 'black'), '', 96);
    return menuCard(anchor, 200, '상점', [art], button('열기', onShop, 'primary'));
  }

  // 우측 중앙
  function bazookaCard(rounds, onWatchAd) {
    const anchor = 'position: absolute; right: 24px; top: 50%; transform: translateY(-50%);';
    const art = artwork(BAZOOKA_IMAGE, '바주카포', 96);
    const action = rounds > 0
      ? button('보유 중', () => {}, 'off')
      : button('📺 획득', onWatchAd, 'ghost');
    return menuCard(anchor, 200, '바주카포', [art, roundsLine(rounds)], action);
  }

  function showMenu(state, handlers) {
    const {
      gold, damageLevel, damageCost, canAffordDamage,
      offlineLevel, offlineCost, canAffordOffline, bazookaRounds,
    } = state;
    clear();

    overlay.appendChild(topBar(gold, handlers));

    const centre = document.createElement('div');
    centre.style.cssText = 'display: flex; flex-direction: column; align-items: center; gap: 14px;';
    const startBtn = button('탭하여 시작', handlers.onStart, 'primary');
    startBtn.style.cssText += 'width: 320px; font-size: 22px; padding: 14px 22px 10px;';
    centre.appendChild(startBtn);
    const hint = document.createElement('div');
    hint.textContent = '클릭하여 조준, 놓아서 발사!';
    hint.style.cssText = 'color: #dadce7; font-size: 15px;';
    centre.appendChild(hint);
    overlay.appendChild(centre);

    overlay.appendChild(shopCard(handlers.onShop));
    overlay.appendChild(bazookaCard(bazookaRounds, handlers.onWatchAdBazooka));
    overlay.appendChild(
      upgradeCard(
        'position: absolute; left: 24px; bottom: 24px;',
        '공격력', damageLevel, damageCost, canAffordDamage,
        handlers.onLevelUpDamage, handlers.onWatchAdDamage
      )
    );
    overlay.appendChild(
      upgradeCard(
        'position: absolute; right: 24px; bottom: 24px;',
        '오프라인', offlineLevel, offlineCost, canAffordOffline,
        handlers.onLevelUpOffline, handlers.onWatchAdOffline
      )
    );

    show();
  }

  function showGameOver({ score, highScore, isNewHighScore }, onReturnToMenu) {
    clear();

    const card = panel();
    card.style.cssText = 'width: 340px; text-align: center;';

    card.appendChild(title('게임 종료'));

    const scoreEl = document.createElement('div');
    scoreEl.style.cssText = 'font-size: 46px; color: #1a1a2e; margin: 6px 0 2px;';
    scoreEl.appendChild(num(score.toLocaleString()));
    card.appendChild(scoreEl);

    card.appendChild(divider());

    const highRow = document.createElement('div');
    highRow.style.cssText = 'display: flex; align-items: center; justify-content: center; gap: 8px; color: #4a4a5e; font-size: 16px;';
    if (isNewHighScore) {
      const trophy = document.createElement('img');
      trophy.src = iconUrl('trophy', 'black');
      trophy.alt = '';
      trophy.style.cssText = 'width: 20px; height: 20px;';
      highRow.appendChild(trophy);
    }
    highRow.appendChild(document.createTextNode(isNewHighScore ? '신기록! ' : '최고점수 '));
    highRow.appendChild(num(highScore.toLocaleString()));
    card.appendChild(highRow);

    const backBtn = button('메인 메뉴로', onReturnToMenu, 'primary');
    backBtn.style.cssText += 'width: 100%; margin-top: 16px;';
    card.appendChild(backBtn);

    overlay.appendChild(card);
    show();
  }

  function showLoading(text) {
    clear();
    const el = document.createElement('div');
    el.textContent = text;
    el.style.cssText = 'color: #dadce7; font-size: 18px;';
    overlay.appendChild(el);
    show();
  }

  return { showMenu, showGameOver, showLoading, hide, dispose: () => overlay.remove() };
}

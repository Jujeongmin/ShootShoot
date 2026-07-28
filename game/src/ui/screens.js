import { scrim, panel, button, iconButton, badge, divider, title, num, iconUrl } from './kit.js';

const BAZOOKA_MAX_ROUNDS = 5;

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
    right.appendChild(iconButton('cart', '상점', handlers.onShop, 44));
    right.appendChild(iconButton('video', '광고 보상', handlers.onAdReward, 44));
    right.appendChild(iconButton('gear', '설정', handlers.onSettings, 44));
    bar.appendChild(right);

    return bar;
  }

  // 하단 독의 카드 한 장. 강화 카드 두 장과 바주카 카드가 같은 틀을 쓴다.
  function dockCard(headingText, subtitleNode, actionNode) {
    const card = panel();
    card.style.cssText = 'width: 220px; text-align: center;';
    card.appendChild(title(headingText));
    card.appendChild(subtitleNode);
    card.appendChild(actionNode);
    return card;
  }

  function levelLine(level) {
    const line = document.createElement('div');
    line.style.cssText = 'color: #4a4a5e; font-size: 15px; margin-bottom: 12px;';
    line.appendChild(document.createTextNode('Lv.'));
    line.appendChild(num(String(level)));
    return line;
  }

  function upgradeCard(headingText, level, cost, canAfford, onUpgrade, onWatchAd) {
    const action = canAfford
      ? button(`🪙 ${cost.toLocaleString()} 강화`, onUpgrade, 'primary')
      : button('📺 무료강화', onWatchAd, 'ghost');
    action.style.width = '100%';
    return dockCard(headingText, levelLine(level), action);
  }

  function bazookaCard(rounds, onWatchAd) {
    let subtitle;
    let action;
    if (rounds > 0) {
      subtitle = document.createElement('div');
      subtitle.style.cssText = 'color: #4a4a5e; font-size: 15px; margin-bottom: 12px;';
      subtitle.appendChild(num(`${rounds}/${BAZOOKA_MAX_ROUNDS}`));
      action = button('보유 중', () => {}, 'off');
    } else {
      subtitle = document.createElement('div');
      subtitle.style.cssText = 'color: #4a4a5e; font-size: 15px; margin-bottom: 12px;';
      subtitle.appendChild(num(`0/${BAZOOKA_MAX_ROUNDS}`));
      action = button('📺 획득', onWatchAd, 'ghost');
    }
    action.style.width = '100%';
    return dockCard('바주카포', subtitle, action);
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

    const dock = document.createElement('div');
    dock.style.cssText = `
      position: absolute; bottom: 24px; left: 50%; transform: translateX(-50%);
      display: flex; align-items: flex-end; gap: 16px;
    `;
    dock.appendChild(
      upgradeCard('공격력', damageLevel, damageCost, canAffordDamage, handlers.onLevelUpDamage, handlers.onWatchAdDamage)
    );
    dock.appendChild(bazookaCard(bazookaRounds, handlers.onWatchAdBazooka));
    dock.appendChild(
      upgradeCard('오프라인', offlineLevel, offlineCost, canAffordOffline, handlers.onLevelUpOffline, handlers.onWatchAdOffline)
    );
    overlay.appendChild(dock);

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

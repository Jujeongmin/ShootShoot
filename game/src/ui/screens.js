import { scrim, panel, button, iconButton, artButton, badge, divider, title, num, iconUrl } from './kit.js';

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
    right.appendChild(iconButton('gear', '설정', handlers.onSettings, 44));
    bar.appendChild(right);

    return bar;
  }

  // 메뉴의 카드는 전부 이 틀을 쓴다. anchorCss 로 화면 어디에 붙을지만 달라진다.
  // 패널 프레임이 없어 글자가 3D 장면 위에 바로 놓이므로 k-on-dark 로 색을 뒤집는다.
  // actionNode 는 없어도 된다 — 상점 카드는 그림 자체가 버튼이라 아래에 붙는
  // 사각 버튼이 없다.
  function menuCard(anchorCss, width, headingText, bodyNodes, actionNode = null) {
    const card = document.createElement('div');
    card.className = 'k-on-dark';
    card.style.cssText = `${anchorCss} width: ${width}px; text-align: center;`;
    card.appendChild(title(headingText));
    for (const node of bodyNodes) card.appendChild(node);
    if (actionNode) {
      actionNode.style.width = '100%';
      card.appendChild(actionNode);
    }
    return card;
  }

  // 무기 그림은 tools/crop-weapon-art.mjs 로 투명 여백을 잘라 둔 상태라
  // contain 이 그림 자체에 맞는다. 여백이 다시 붙은 그림을 넣으면 작아진다.
  // 그림이 아직 없을 수 있다. 깨진 이미지 아이콘 대신 자리만 비운다.
  function artwork(src, alt, height) {
    const frame = document.createElement('div');
    frame.style.cssText = `
      display: flex; align-items: center; justify-content: center;
      height: ${height}px; margin: 4px 0 8px;
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
    line.className = 'k-meta';
    line.appendChild(document.createTextNode('Lv.'));
    line.appendChild(num(String(level)));
    return line;
  }

  function roundsLine(rounds) {
    const line = document.createElement('div');
    line.className = 'k-meta';
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

  // 좌측 중앙. 제목과 그림뿐이고, 그림을 누르면 상점이 열린다.
  function shopCard(onShop) {
    const anchor = 'position: absolute; left: 24px; top: 50%; transform: translateY(-50%);';
    // 패널이 없어 어두운 장면 위에 놓인다. 검정 아이콘은 여기서 안 보인다.
    const art = artButton('cart', '상점 열기', onShop, 104, { tone: 'white' });
    art.style.margin = '6px 0 2px';
    return menuCard(anchor, 200, '상점', [art]);
  }

  // 우측 중앙. 그림 폭에 맞춰 카드를 넓힌다 — 260px 폭에서 총 자체가 약 53px 높이가 된다.
  function bazookaCard(rounds, onWatchAd) {
    const anchor = 'position: absolute; right: 24px; top: 50%; transform: translateY(-50%);';
    const art = artwork(BAZOOKA_IMAGE, '바주카포', 76);
    const action = rounds > 0
      ? button('보유 중', () => {}, 'off')
      : button('📺 획득', onWatchAd, 'ghost');
    return menuCard(anchor, 260, '바주카포', [art, roundsLine(rounds)], action);
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

    card.appendChild(title('기록'));

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

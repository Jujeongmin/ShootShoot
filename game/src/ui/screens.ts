import { scrim, panel, button, iconButton, artButton, badge, divider, title, num, iconUrl, TOKENS } from './kit';

const BAZOOKA_MAX_ROUNDS = 5;
// game/thumb.html 로 뽑는다. 아직 없어도 카드는 뜨고 그림 자리만 비운다.
const BAZOOKA_IMAGE = '/images/weapons/bazooka.png';

// showMenu(state, handlers)의 계약. 호출부는 game.ts의 buildMenuState()이고 타입도
// 이미 붙어 있지만, game.ts가 이 파일을 가져오는 쪽이라 거꾸로 가져오면 순환 참조가
// 생긴다. 그래서 여기서 쓰는 필드만 좁게 다시 적어 둔다.
interface MenuState {
  gold: number;
  damageLevel: number;
  damageCost: number;
  canAffordDamage: boolean;
  offlineLevel: number;
  offlineCost: number;
  canAffordOffline: boolean;
  bazookaRounds: number;
  reachedRound: number;
}

interface MenuHandlers {
  onSettings: () => void;
  onContinue: () => void;
  onRoundSelect: () => void;
  onNewGame: () => void;
  onStart: () => void;
  onShop: () => void;
  onWatchAdBazooka: () => void;
  onLevelUpDamage: () => void;
  onWatchAdDamage: () => void;
  onLevelUpOffline: () => void;
  onWatchAdOffline: () => void;
}

export function createScreens(container: HTMLElement) {
  const overlay = scrim();
  overlay.style.zIndex = '20';
  container.appendChild(overlay);

  function clear() {
    overlay.classList.remove('menu-layout');
    overlay.innerHTML = '';
  }

  function show() {
    overlay.style.display = 'flex';
  }

  function hide() {
    overlay.classList.remove('menu-layout');
    overlay.style.display = 'none';
  }

  // 상단 바: 좌측 로고, 우측 골드 배지 + 아이콘 버튼 3개.
  function topBar(gold: number, handlers: MenuHandlers) {
    const bar = document.createElement('div');
    bar.className = 'menu-topbar';
    bar.style.cssText = `
      position: absolute; top: 16px; left: 20px; right: 20px;
      display: flex; align-items: center; justify-content: space-between;
    `;

    const logo = document.createElement('div');
    logo.textContent = 'SHOOTSHOOT';
    logo.style.cssText = `
      font-family: 'Kenney Future', sans-serif; font-size: 22px; letter-spacing: 2px;
      color: ${TOKENS.face}; text-shadow: 0 2px 0 ${TOKENS.deep};
    `;
    bar.appendChild(logo);

    const right = document.createElement('div');
    right.style.cssText = 'display: flex; align-items: center; gap: 10px;';
    right.appendChild(badge(`🪙 ${gold.toLocaleString()}`));
    right.appendChild(iconButton('gear', 'Settings', handlers.onSettings, 44));
    bar.appendChild(right);

    return bar;
  }

  // 메뉴의 카드는 전부 이 틀을 쓴다. anchorCss 로 화면 어디에 붙을지만 달라진다.
  // 패널 프레임이 없어 글자가 3D 장면 위에 바로 놓이므로 k-on-dark 로 색을 뒤집는다.
  // actionNode 는 없어도 된다 — 상점 카드는 그림 자체가 버튼이라 아래에 붙는
  // 사각 버튼이 없다.
  function menuCard(
    anchorCss: string,
    width: number,
    headingText: string,
    bodyNodes: HTMLElement[],
    actionNode: HTMLElement | null = null,
  ) {
    const card = document.createElement('div');
    card.className = 'k-on-dark menu-card';
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
  function artwork(src: string, alt: string, height: number) {
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

  function levelLine(level: number) {
    const line = document.createElement('div');
    line.className = 'k-meta';
    line.appendChild(document.createTextNode('Lv.'));
    line.appendChild(num(String(level)));
    return line;
  }

  function roundsLine(rounds: number) {
    const line = document.createElement('div');
    line.className = 'k-meta';
    line.appendChild(num(`${rounds}/${BAZOOKA_MAX_ROUNDS}`));
    return line;
  }

  // 좌하단 / 우하단
  function upgradeCard(
    anchorCss: string,
    headingText: string,
    level: number,
    cost: number,
    canAfford: boolean,
    onUpgrade: () => void,
    onWatchAd: () => void,
  ) {
    const action = canAfford
      ? button(`🪙 ${cost.toLocaleString()} Upgrade`, onUpgrade, 'primary')
      : button('📺 Free upgrade', onWatchAd, 'ghost');
    return menuCard(anchorCss, 240, headingText, [levelLine(level)], action);
  }

  // 좌측 중앙. 제목과 그림뿐이고, 그림을 누르면 상점이 열린다.
  function shopCard(onShop: () => void) {
    const anchor = 'position: absolute; left: 24px; top: 50%; transform: translateY(-50%);';
    // 패널이 없어 어두운 장면 위에 놓인다. 검정 아이콘은 여기서 안 보인다.
    const art = artButton('cart', 'Open shop', onShop, 104, { tone: 'white' });
    art.style.margin = '6px 0 2px';
    return menuCard(anchor, 200, 'Shop', [art]);
  }

  // 우측 중앙. 그림 폭에 맞춰 카드를 넓힌다 — 260px 폭에서 총 자체가 약 53px 높이가 된다.
  function bazookaCard(rounds: number, onWatchAd: () => void) {
    const anchor = 'position: absolute; right: 24px; top: 50%; transform: translateY(-50%);';
    const art = artwork(BAZOOKA_IMAGE, 'Bazooka', 76);
    const action = rounds > 0
      ? button('Owned', () => {}, 'off')
      : button('📺 Get', onWatchAd, 'ghost');
    return menuCard(anchor, 260, 'Bazooka', [art, roundsLine(rounds)], action);
  }

  function showMenu(state: MenuState, handlers: MenuHandlers) {
    const {
      gold, damageLevel, damageCost, canAffordDamage,
      offlineLevel, offlineCost, canAffordOffline, bazookaRounds, reachedRound,
    } = state;
    clear();
    overlay.classList.add('menu-layout');

    overlay.appendChild(topBar(gold, handlers));

    const centre = document.createElement('div');
    // 카드와 달리 패널 틀이 없어 글자가 어두운 3D 장면 위에 바로 놓인다. ghost 버튼의
    // 기본색은 회색 패널을 전제한 --k-ink 라 여기서는 안 보인다. k-on-dark 가 색을 뒤집는다.
    centre.className = 'k-on-dark';
    centre.classList.add('menu-centre');
    centre.style.cssText = 'display: flex; flex-direction: column; align-items: center; gap: 14px;';
    // 아직 아무것도 못 깬 플레이어에게 '이어하기'는 뜻이 없다. 그때는 예전처럼
    // 큰 버튼 하나만 둔다.
    if (reachedRound > 1) {
      const continueBtn = button(`Continue (round ${reachedRound})`, handlers.onContinue, 'primary');
      continueBtn.style.cssText += 'width: 320px; font-size: 22px; padding: 14px 22px 10px;';
      centre.appendChild(continueBtn);
      const selectBtn = button('Select round', handlers.onRoundSelect, 'ghost');
      selectBtn.style.cssText += 'width: 320px;';
      centre.appendChild(selectBtn);
      const newGameBtn = button('Start over', handlers.onNewGame, 'ghost');
      newGameBtn.style.cssText += 'width: 320px;';
      centre.appendChild(newGameBtn);
    } else {
      const startBtn = button('Tap to start', handlers.onStart, 'primary');
      startBtn.style.cssText += 'width: 320px; font-size: 22px; padding: 14px 22px 10px;';
      centre.appendChild(startBtn);
    }
    const hint = document.createElement('div');
    hint.textContent = 'Hold to aim, release to fire!';
    hint.style.cssText = `color: ${TOKENS.grey}; font-size: 15px;`;
    centre.appendChild(hint);
    overlay.appendChild(centre);

    overlay.appendChild(shopCard(handlers.onShop));
    overlay.appendChild(bazookaCard(bazookaRounds, handlers.onWatchAdBazooka));
    overlay.appendChild(
      upgradeCard(
        'position: absolute; left: 24px; bottom: 24px;',
        'Damage', damageLevel, damageCost, canAffordDamage,
        handlers.onLevelUpDamage, handlers.onWatchAdDamage
      )
    );
    overlay.appendChild(
      upgradeCard(
        'position: absolute; right: 24px; bottom: 24px;',
        'Offline', offlineLevel, offlineCost, canAffordOffline,
        handlers.onLevelUpOffline, handlers.onWatchAdOffline
      )
    );

    show();
  }

  function showGameOver(
    { score, highScore, isNewHighScore }: { score: number; highScore: number; isNewHighScore: boolean },
    onReturnToMenu: () => void,
  ) {
    clear();

    const card = panel();
    card.classList.add('responsive-panel');
    card.style.cssText = 'width: 340px; text-align: center;';

    card.appendChild(title('Score'));

    const scoreEl = document.createElement('div');
    scoreEl.style.cssText = `font-size: 46px; color: ${TOKENS.ink}; margin: 6px 0 2px;`;
    scoreEl.appendChild(num(score.toLocaleString()));
    card.appendChild(scoreEl);

    card.appendChild(divider());

    const highRow = document.createElement('div');
    highRow.style.cssText = `display: flex; align-items: center; justify-content: center; gap: 8px; color: ${TOKENS.inkSoft}; font-size: 16px;`;
    if (isNewHighScore) {
      const trophy = document.createElement('img');
      trophy.src = iconUrl('trophy', 'black');
      trophy.alt = '';
      trophy.style.cssText = 'width: 20px; height: 20px;';
      highRow.appendChild(trophy);
    }
    highRow.appendChild(document.createTextNode(isNewHighScore ? 'New best! ' : 'Best '));
    highRow.appendChild(num(highScore.toLocaleString()));
    card.appendChild(highRow);

    const backBtn = button('Main menu', onReturnToMenu, 'primary');
    backBtn.style.cssText += 'width: 100%; margin-top: 16px;';
    card.appendChild(backBtn);

    overlay.appendChild(card);
    show();
  }

  function showLoading(text: string) {
    clear();
    const el = document.createElement('div');
    el.textContent = text;
    el.style.cssText = `color: ${TOKENS.grey}; font-size: 18px;`;
    overlay.appendChild(el);
    show();
  }

  return { showMenu, showGameOver, showLoading, hide, dispose: () => overlay.remove() };
}

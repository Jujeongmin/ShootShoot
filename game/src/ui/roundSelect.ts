import { scrim, panel, button, iconButton, title, TOKENS } from './kit';
import type { ButtonVariant } from './kit';

const COLUMNS = 5;

// 깬 라운드를 다시 고를 수 있게 한다. 라운드에 상한이 없어서 도달 라운드까지만
// 그린다 — 잠긴 칸을 몇 개 보여줄지 정할 기준이 없다.
export function createRoundSelect(container: HTMLElement) {
  const overlay = scrim();
  // 설정·상점과 같은 층이다.
  overlay.style.zIndex = '25';
  container.appendChild(overlay);

  function show(reachedRound: number, onPick: (round: number) => void, onClose: () => void) {
    overlay.innerHTML = '';

    const box = panel();
    box.style.cssText = 'position: relative; text-align: center; width: 420px; max-width: 90vw;';

    const closeBtn = iconButton('cross', '닫기', onClose, 36);
    closeBtn.style.cssText += 'position: absolute; top: -14px; right: -14px;';
    box.appendChild(closeBtn);

    box.appendChild(title('라운드 선택'));

    const hint = document.createElement('div');
    hint.style.cssText = `color: ${TOKENS.inkSoft}; font-size: 15px; margin: 8px 0 4px;`;
    hint.textContent = '깬 라운드를 다시 고를 수 있습니다.';
    box.appendChild(hint);

    // 라운드가 100개를 넘어도 패널은 화면에 고정돼야 한다. 격자 안에서만 스크롤한다.
    const grid = document.createElement('div');
    grid.style.cssText = `
      display: grid; grid-template-columns: repeat(${COLUMNS}, 1fr); gap: 8px;
      margin-top: 12px; max-height: 46vh; overflow-y: auto; padding: 4px;
    `;
    for (let round = 1; round <= reachedRound; round += 1) {
      // 지금 이어할 라운드만 채운 색으로 눈에 띄게 둔다.
      const variant: ButtonVariant = round === reachedRound ? 'primary' : 'ghost';
      grid.appendChild(button(String(round), () => onPick(round), variant));
    }
    box.appendChild(grid);

    overlay.appendChild(box);
    overlay.style.display = 'flex';
  }

  function hide() {
    overlay.style.display = 'none';
  }

  return { show, hide };
}

import { scrim, panel, button, title, num, TOKENS } from './kit';

export function createOfflineRewardPopup(container: HTMLElement) {
  const overlay = scrim();
  overlay.style.zIndex = '25';
  container.appendChild(overlay);

  function show(goldAmount: number, onClaim: () => void) {
    overlay.innerHTML = '';

    const box = panel();
    box.style.cssText = 'text-align: center; min-width: 280px;';
    box.appendChild(title('Offline reward'));

    const amount = document.createElement('div');
    amount.style.cssText = `font-size: 40px; color: ${TOKENS.ink}; margin: 8px 0 4px;`;
    amount.appendChild(document.createTextNode('🪙 '));
    amount.appendChild(num(goldAmount.toLocaleString()));
    box.appendChild(amount);

    const message = document.createElement('div');
    message.textContent = 'Gold you earned while away!';
    message.style.cssText = `color: ${TOKENS.inkSoft}; font-size: 14px;`;
    box.appendChild(message);

    const claimBtn = button('Collect', () => {
      overlay.style.display = 'none';
      onClaim();
    }, 'primary');
    claimBtn.style.cssText += 'width: 100%; margin-top: 16px;';
    box.appendChild(claimBtn);

    overlay.appendChild(box);
    overlay.style.display = 'flex';
  }

  return { show };
}

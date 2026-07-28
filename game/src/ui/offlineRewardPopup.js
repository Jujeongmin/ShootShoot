import { scrim, panel, button, title, num } from './kit.js';

export function createOfflineRewardPopup(container) {
  const overlay = scrim();
  overlay.style.zIndex = '25';
  container.appendChild(overlay);

  function show(goldAmount, onClaim) {
    overlay.innerHTML = '';

    const box = panel();
    box.style.cssText = 'text-align: center; min-width: 280px;';
    box.appendChild(title('오프라인 보상'));

    const amount = document.createElement('div');
    amount.style.cssText = 'font-size: 40px; color: #1a1a2e; margin: 8px 0 4px;';
    amount.appendChild(document.createTextNode('🪙 '));
    amount.appendChild(num(goldAmount.toLocaleString()));
    box.appendChild(amount);

    const message = document.createElement('div');
    message.textContent = '자리를 비운 사이 모은 골드입니다!';
    message.style.cssText = 'color: #4a4a5e; font-size: 14px;';
    box.appendChild(message);

    const claimBtn = button('받기', () => {
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

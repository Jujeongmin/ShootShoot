export function createOfflineRewardPopup(container) {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: absolute; inset: 0; display: none; flex-direction: column;
    align-items: center; justify-content: center; color: #fff;
    font-family: sans-serif; background: rgba(0,0,0,0.7); z-index: 25;
  `;
  container.appendChild(overlay);

  function show(goldAmount, onClaim) {
    overlay.innerHTML = '';

    const title = document.createElement('h2');
    title.textContent = '오프라인 보상';
    overlay.appendChild(title);

    const message = document.createElement('p');
    message.textContent = `자리를 비운 사이 골드 ${goldAmount}개를 모았습니다!`;
    overlay.appendChild(message);

    const claimBtn = document.createElement('button');
    claimBtn.textContent = '받기';
    claimBtn.style.cssText = `
      margin-top: 16px; padding: 10px 24px; font-size: 18px; cursor: pointer;
      border: none; border-radius: 6px; background: #f0a500; color: #1a1a2e;
    `;
    claimBtn.addEventListener('click', () => {
      overlay.style.display = 'none';
      onClaim();
    });
    overlay.appendChild(claimBtn);

    overlay.style.display = 'flex';
  }

  return { show };
}

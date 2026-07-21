export function createAdRewardPanel(container) {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: absolute; inset: 0; display: none; flex-direction: column;
    align-items: center; justify-content: center; color: #fff;
    font-family: sans-serif; background: rgba(0,0,0,0.7); z-index: 25;
  `;
  container.appendChild(overlay);

  function lockedCard(label) {
    const el = document.createElement('div');
    el.textContent = label;
    el.style.cssText = `
      margin: 8px; padding: 16px 24px; border-radius: 6px; min-width: 160px;
      text-align: center; background: rgba(255,255,255,0.1); color: #888;
      border: 1px solid #555;
    `;
    return el;
  }

  function show(onClose, onWatchAd) {
    overlay.innerHTML = '';

    const title = document.createElement('h2');
    title.textContent = '광고 보상';
    overlay.appendChild(title);

    const list = document.createElement('div');
    list.style.cssText = 'display: flex; flex-direction: row;';

    const goldBtn = document.createElement('button');
    goldBtn.textContent = '골드 30개 받기';
    goldBtn.style.cssText = `
      margin: 8px; padding: 16px 24px; font-size: 16px; cursor: pointer;
      border: none; border-radius: 6px; background: #f0a500; color: #1a1a2e; min-width: 160px;
    `;
    goldBtn.addEventListener('click', () => {
      goldBtn.disabled = true;
      goldBtn.textContent = '광고 재생 중...';
      onWatchAd();
    });
    list.appendChild(goldBtn);
    list.appendChild(lockedCard('바주카'));
    overlay.appendChild(list);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '닫기';
    closeBtn.style.cssText = `
      margin-top: 16px; padding: 10px 24px; font-size: 18px; cursor: pointer;
      border: none; border-radius: 6px; background: #f0a500; color: #1a1a2e;
    `;
    closeBtn.addEventListener('click', onClose);
    overlay.appendChild(closeBtn);

    overlay.style.display = 'flex';
  }

  function hide() {
    overlay.style.display = 'none';
  }

  return { show, hide };
}

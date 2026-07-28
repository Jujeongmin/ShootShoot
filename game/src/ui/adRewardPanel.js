import { scrim, panel, button, iconButton, title, iconUrl } from './kit.js';

export function createAdRewardPanel(container) {
  const overlay = scrim();
  overlay.style.zIndex = '25';
  container.appendChild(overlay);

  function lockedCard(label) {
    const el = document.createElement('div');
    el.style.cssText = `
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      min-width: 150px; padding: 16px 12px;
    `;
    const lock = document.createElement('img');
    lock.src = iconUrl('locked', 'black');
    lock.alt = '';
    lock.style.cssText = 'width: 28px; height: 28px; opacity: 0.5;';
    el.appendChild(lock);
    el.appendChild(button(label, () => {}, 'off'));
    return el;
  }

  function show(onClose, onWatchAd) {
    overlay.innerHTML = '';

    const box = panel();
    box.style.cssText = 'position: relative; text-align: center;';

    const closeBtn = iconButton('cross', '닫기', onClose, 36);
    closeBtn.style.cssText += 'position: absolute; top: -14px; right: -14px;';
    box.appendChild(closeBtn);

    box.appendChild(title('광고 보상'));

    const list = document.createElement('div');
    list.style.cssText = 'display: flex; align-items: center; gap: 12px; margin-top: 10px;';

    const goldWrap = document.createElement('div');
    goldWrap.style.cssText = `
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      min-width: 150px; padding: 16px 12px;
    `;
    const video = document.createElement('img');
    video.src = iconUrl('video', 'black');
    video.alt = '';
    video.style.cssText = 'width: 28px; height: 28px;';
    goldWrap.appendChild(video);

    const goldBtn = button('🪙 30개 받기', () => {
      goldBtn.disabled = true;
      goldBtn.textContent = '광고 재생 중...';
      onWatchAd();
    }, 'primary');
    goldWrap.appendChild(goldBtn);
    list.appendChild(goldWrap);

    list.appendChild(lockedCard('바주카'));
    box.appendChild(list);

    overlay.appendChild(box);
    overlay.style.display = 'flex';
  }

  function hide() {
    overlay.style.display = 'none';
  }

  return { show, hide };
}

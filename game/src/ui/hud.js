export function createHud(container) {
  const el = document.createElement('div');
  el.style.cssText = `
    position: absolute; top: 12px; left: 12px; color: #fff;
    font-family: sans-serif; font-size: 20px; text-shadow: 0 1px 3px rgba(0,0,0,0.8);
    pointer-events: none; z-index: 10;
  `;
  container.appendChild(el);

  function render({ score, streak, round, timeRemaining, ammo, ammoMax }) {
    el.innerHTML = `
      <div>점수: ${score}</div>
      <div>연속: ${streak}</div>
      <div>라운드: ${round}</div>
      <div>남은 시간: ${Math.ceil(timeRemaining)}s</div>
      <div>총알: ${ammo}/${ammoMax}</div>
    `;
  }

  function showScorePopup(text, clientX, clientY) {
    const popup = document.createElement('div');
    popup.textContent = text;
    popup.style.cssText = `
      position: absolute; left: ${clientX}px; top: ${clientY}px; transform: translate(-50%, -50%);
      color: #ffdd55; font-weight: bold; font-size: 24px; pointer-events: none;
      text-shadow: 0 1px 3px rgba(0,0,0,0.8); transition: transform 0.6s ease-out, opacity 0.6s ease-out;
      z-index: 15;
    `;
    container.appendChild(popup);
    requestAnimationFrame(() => {
      popup.style.transform = 'translate(-50%, -120%)';
      popup.style.opacity = '0';
    });
    setTimeout(() => popup.remove(), 650);
  }

  function dispose() {
    el.remove();
  }

  return { render, showScorePopup, dispose };
}

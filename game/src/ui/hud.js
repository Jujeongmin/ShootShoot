export function createHud(container) {
  const el = document.createElement('div');
  el.style.cssText = `
    position: absolute; top: 12px; left: 12px; color: #fff;
    font-family: sans-serif; font-size: 20px; text-shadow: 0 1px 3px rgba(0,0,0,0.8);
    pointer-events: none; z-index: 10;
  `;
  container.appendChild(el);

  function render({ score, streak, round, timeRemaining }) {
    el.innerHTML = `
      <div>점수: ${score}</div>
      <div>연속: ${streak}</div>
      <div>라운드: ${round}</div>
      <div>남은 시간: ${Math.ceil(timeRemaining)}s</div>
    `;
  }

  function dispose() {
    el.remove();
  }

  return { render, dispose };
}

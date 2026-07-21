export function createStageBanner(container) {
  function show(stageNumber) {
    const el = document.createElement('div');
    el.textContent = `STAGE ${stageNumber}`;
    el.style.cssText = `
      position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
      color: #fff; font-family: sans-serif; font-size: 56px; font-weight: bold;
      text-shadow: 0 2px 8px rgba(0,0,0,0.8); letter-spacing: 4px;
      pointer-events: none; z-index: 16; opacity: 0; transition: opacity 0.3s ease;
    `;
    container.appendChild(el);

    requestAnimationFrame(() => {
      el.style.opacity = '1';
    });

    setTimeout(() => {
      el.style.opacity = '0';
    }, 600);

    setTimeout(() => {
      el.remove();
    }, 1000);
  }

  return { show };
}

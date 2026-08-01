import { TOKENS } from './kit';

export function createStageBanner(container: HTMLElement) {
  function show(stageNumber: number) {
    const el = document.createElement('div');
    el.textContent = `STAGE ${stageNumber}`;
    el.style.cssText = `
      position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
      font-family: 'Kenney Future', sans-serif; font-size: 56px; font-weight: bold;
      color: ${TOKENS.face}; letter-spacing: 4px;
      text-shadow: 0 4px 0 ${TOKENS.deep}, 0 6px 12px rgba(0,0,0,0.7);
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

export function createShopPanel(container) {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: absolute; inset: 0; display: none; flex-direction: column;
    align-items: center; justify-content: center; color: #fff;
    font-family: sans-serif; background: rgba(0,0,0,0.7); z-index: 25;
  `;
  container.appendChild(overlay);

  function card(label, locked) {
    const el = document.createElement('div');
    el.textContent = label;
    el.style.cssText = `
      margin: 8px; padding: 16px 24px; border-radius: 6px; min-width: 160px;
      text-align: center;
      background: ${locked ? 'rgba(255,255,255,0.1)' : 'rgba(240,165,0,0.2)'};
      color: ${locked ? '#888' : '#fff'};
      border: 1px solid ${locked ? '#555' : '#f0a500'};
    `;
    return el;
  }

  function show(onClose) {
    overlay.innerHTML = '';

    const title = document.createElement('h2');
    title.textContent = '무기 상점';
    overlay.appendChild(title);

    const list = document.createElement('div');
    list.style.cssText = 'display: flex; flex-direction: row;';
    list.appendChild(card('장착 중: 저격총', false));
    list.appendChild(card('준비 중', true));
    list.appendChild(card('준비 중', true));
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

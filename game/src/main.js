import { createSettingsPanel } from './ui/settingsPanel.js';

const container = document.getElementById('app');
container.style.background = '#1a1a2e';
const panel = createSettingsPanel(container);

let sensitivity = 1.0;
panel.show(
  sensitivity,
  (value) => {
    sensitivity = value;
    console.log('sensitivity changed to', value);
  },
  () => {
    console.log('closed');
    panel.hide();
  }
);

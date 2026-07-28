import './ui/theme.css';
import { createGame } from './gameplay/game.js';

const container = document.getElementById('app');
const game = createGame(container);
game.start();

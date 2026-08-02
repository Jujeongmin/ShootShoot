import './ui/theme.css';
import { createGame } from './gameplay/game';

const container = document.getElementById('app');
// index.html 이 이 요소를 갖고 있다. 없으면 게임이 붙을 곳이 없으니 조용히
// 넘어가지 않고 여기서 멈춘다 — 아래로 내려가면 확인할 자리가 흩어진다.
if (!container) throw new Error('Could not find the #app element');
const game = createGame(container);
game.start();

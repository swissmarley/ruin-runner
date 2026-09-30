import { Game } from './core/Game';
import './ui/styles.css';

const container = document.getElementById('app');
if (!container) throw new Error('Missing #app container');

const game = new Game(container);
game.start();

// Dev-only handle for smoke tests from the browser console.
if (import.meta.env.DEV) (window as unknown as { __game: Game }).__game = game;

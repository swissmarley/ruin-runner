import { Game } from './core/Game';
import { registerServiceWorker } from './pwa';
import './ui/styles/base.css';
import './ui/styles/overlays.css';
import './ui/styles/hud.css';
import './ui/styles/settings.css';

const container = document.getElementById('app');
if (!container) throw new Error('Missing #app container');

const game = new Game(container);
game.start();
registerServiceWorker();

// Dev-only handle for smoke tests from the browser console.
if (import.meta.env.DEV) (window as unknown as { __game: Game }).__game = game;

import { button, el, Overlay } from './dom';

export interface PauseActions {
  onResume(): void;
  onMenu(): void;
}

/** Pause card shown over the frozen run. */
export class Pause extends Overlay {
  constructor(parent: HTMLElement, actions: PauseActions) {
    super(parent, 'pause');
    const card = el('div', 'card');
    card.append(
      el('h2', 'go-title', 'Paused'),
      button('Resume', 'primary', actions.onResume),
      button('Menu', 'secondary', actions.onMenu),
    );
    this.root.appendChild(card);
  }
}

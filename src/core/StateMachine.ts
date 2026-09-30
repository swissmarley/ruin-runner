export type GameState = 'Boot' | 'Menu' | 'Playing' | 'Paused' | 'GameOver';

/** Allowed transitions: Boot → Menu → Playing ⇄ Paused → GameOver → Menu | Playing. */
const TRANSITIONS: Record<GameState, readonly GameState[]> = {
  Boot: ['Menu'],
  Menu: ['Playing'],
  Playing: ['Paused', 'GameOver', 'Menu'],
  Paused: ['Playing', 'Menu'],
  GameOver: ['Menu', 'Playing'],
};

export type StateListener = (to: GameState, from: GameState) => void;

export class StateMachine {
  private current: GameState = 'Boot';
  private readonly listeners: StateListener[] = [];

  get state(): GameState {
    return this.current;
  }

  can(to: GameState): boolean {
    return TRANSITIONS[this.current].includes(to);
  }

  /** Transitions if allowed. Returns false (and does nothing) otherwise. */
  go(to: GameState): boolean {
    if (!this.can(to)) return false;
    const from = this.current;
    this.current = to;
    for (const l of this.listeners) l(to, from);
    return true;
  }

  onChange(listener: StateListener): void {
    this.listeners.push(listener);
  }
}

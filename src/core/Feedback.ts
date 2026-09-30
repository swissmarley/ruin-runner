import type { AudioManager } from '../audio/AudioManager';
import type { SfxName } from '../audio/Sfx';
import type { GameView } from '../render/GameView';
import type { SimEvents, SimEventType } from '../sim/SimEvents';
import type { Haptics } from './Haptics';

const SFX_FOR: Partial<Record<SimEventType, SfxName>> = {
  coin: 'coin',
  jump: 'jump',
  slide: 'slide',
  land: 'land',
  lane: 'lane',
  turn: 'turn',
  stumble: 'stumble',
  death: 'death',
  powerup: 'powerup',
  shieldBreak: 'shieldBreak',
  surgeSmash: 'smash',
};

/**
 * Routes simulation events to presentation: visuals always, sound and haptics only when a
 * human is playing (the attract-mode demo behind the menu stays quiet apart from music).
 */
export class Feedback {
  constructor(
    private readonly view: GameView,
    private readonly audio: AudioManager,
    private readonly haptics: Haptics,
  ) {}

  drain(events: SimEvents, audible: boolean): void {
    for (let i = 0; i < events.count; i++) {
      const type = events.types[i]!;
      const value = events.values[i]!;
      this.view.onEvent(type, value);
      if (!audible) continue;
      const sfx = SFX_FOR[type];
      if (sfx) this.audio.play(sfx, value);
      if (type === 'stumble') this.haptics.pulse(45);
      else if (type === 'shieldBreak') this.haptics.pulse(25);
      else if (type === 'death') this.haptics.pulse([80, 40, 120]);
    }
    events.clear();
  }

  crumble(audible: boolean): void {
    if (audible) {
      this.audio.play('crumble');
      this.haptics.pulse(20);
    }
  }
}

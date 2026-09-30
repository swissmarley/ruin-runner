import type { Pattern } from './ObstaclePatterns';
import { PATTERNS } from './ObstaclePatterns';

export type HintKey = 'jump' | 'slide' | 'lane' | 'turn';

export interface TutorialStep {
  hint: HintKey;
  /** Pattern name from the library, or null for a plain straight. */
  pattern: string | null;
  cornerAfter: boolean;
}

/** First-run lessons, one per straight: jump, slide, dodge, then a corner to turn. */
export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  { hint: 'jump', pattern: 'hurdle', cornerAfter: false },
  { hint: 'slide', pattern: 'duck', cornerAfter: false },
  { hint: 'lane', pattern: 'fallen-two-left', cornerAfter: false },
  { hint: 'turn', pattern: null, cornerAfter: true },
];

/** Generous breathing room before each tutorial obstacle (slots). */
export const TUTORIAL_LEAD_SLOTS = 2.4;
/** How far (slots) before the obstacle its hint sign stands. */
export const HINT_LEAD_SLOTS = 1.6;

export function patternByName(name: string): Pattern {
  const p = PATTERNS.find((x) => x.name === name);
  if (!p) throw new Error(`Unknown pattern "${name}"`);
  return p;
}

/** Hint copy for touch screens and for keyboards. */
export const HINT_TEXT: Record<HintKey, { touch: string; keys: string }> = {
  jump: { touch: 'Swipe UP to jump', keys: '↑ / W / Space to jump' },
  slide: { touch: 'Swipe DOWN to slide', keys: '↓ / S to slide' },
  lane: { touch: 'Swipe LEFT / RIGHT to dodge', keys: '← → / A D to dodge' },
  turn: { touch: 'Swipe toward the turn!', keys: 'Press ← or → to turn!' },
};

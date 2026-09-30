import { TiltInput } from '../input/TiltInput';
import type { QualitySetting, Settings as SettingsState } from '../storage/SaveData';
import { QUALITY_SETTINGS } from '../storage/SaveData';
import { button, el, Overlay } from './dom';

export interface SettingsActions {
  onChange(patch: Partial<SettingsState>): void;
  onReplayTutorial(): void;
  onBack(): void;
}

const QUALITY_LABEL: Record<QualitySetting, string> = {
  auto: 'Auto',
  low: 'Low',
  medium: 'Med',
  high: 'High',
};

type ToggleKey = 'sound' | 'music' | 'haptics' | 'tilt';

/** Sound, music, haptics and graphics quality, plus a tutorial replay. */
export class Settings extends Overlay {
  private readonly toggles = new Map<ToggleKey, HTMLButtonElement>();
  private readonly qualityButtons = new Map<QualitySetting, HTMLButtonElement>();
  private readonly tutorialButton: HTMLButtonElement;

  constructor(parent: HTMLElement, actions: SettingsActions) {
    super(parent, 'settings');
    const card = el('div', 'card');
    card.append(el('h2', 'go-title', 'Settings'));
    const list = el('div', 'settings-list');
    const vibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
    list.append(
      this.toggleRow('sound', 'Sound effects', actions),
      this.toggleRow('music', 'Music', actions),
      this.toggleRow('haptics', vibrate ? 'Haptics' : 'Haptics (not supported here)', actions),
    );
    if (TiltInput.supported)
      list.append(this.toggleRow('tilt', 'Tilt steering (lane-free)', actions));
    const qualityRow = el('div', 'setting-row');
    qualityRow.append(el('span', '', 'Graphics'));
    const seg = el('div', 'segmented');
    seg.setAttribute('role', 'radiogroup');
    for (const q of QUALITY_SETTINGS) {
      const b = el('button', 'seg-btn', QUALITY_LABEL[q]);
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.addEventListener('click', () => actions.onChange({ quality: q }));
      this.qualityButtons.set(q, b);
      seg.append(b);
    }
    qualityRow.append(seg);
    list.append(qualityRow);
    this.tutorialButton = button('Replay tutorial', 'secondary', () => {
      actions.onReplayTutorial();
      this.tutorialButton.textContent = 'Tutorial on next run ✓';
    });
    card.append(list, this.tutorialButton, button('Back', 'primary', actions.onBack));
    this.root.appendChild(card);
  }

  private toggleRow(key: ToggleKey, label: string, actions: SettingsActions): HTMLElement {
    const row = el('div', 'setting-row');
    const t = el('button', 'toggle');
    t.type = 'button';
    t.setAttribute('role', 'switch');
    t.setAttribute('aria-label', label);
    t.addEventListener('click', () => {
      const on = t.getAttribute('aria-checked') !== 'true';
      actions.onChange({ [key]: on } as Partial<SettingsState>);
    });
    this.toggles.set(key, t);
    row.append(el('span', '', label), t);
    return row;
  }

  /** Reflects the current settings in the controls. */
  render(s: SettingsState): void {
    for (const [key, t] of this.toggles) t.setAttribute('aria-checked', String(s[key]));
    for (const [q, b] of this.qualityButtons) {
      b.classList.toggle('active', q === s.quality);
      b.setAttribute('aria-checked', String(q === s.quality));
    }
  }

  open(s: SettingsState): void {
    this.tutorialButton.textContent = 'Replay tutorial';
    this.render(s);
    this.show();
  }
}

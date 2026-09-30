export type QualitySetting = 'auto' | 'low' | 'medium' | 'high';
export const QUALITY_SETTINGS: readonly QualitySetting[] = ['auto', 'low', 'medium', 'high'];

export interface Settings {
  sound: boolean;
  music: boolean;
  haptics: boolean;
  quality: QualitySetting;
  /** Optional lane-free steering with device tilt. */
  tilt: boolean;
}

export interface SaveState {
  version: 1;
  highScore: number;
  bestDistance: number;
  totalCoins: number;
  runs: number;
  tutorialDone: boolean;
  settings: Settings;
}

export const SAVE_KEY = 'ruinrunner.save.v1';

/** Minimal Storage surface so tests can inject an in-memory store. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function defaultSave(): SaveState {
  return {
    version: 1,
    highScore: 0,
    bestDistance: 0,
    totalCoins: 0,
    runs: 0,
    tutorialDone: false,
    settings: { sound: true, music: true, haptics: true, quality: 'auto', tilt: false },
  };
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : fallback;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

/** Validates untrusted parsed JSON, keeping good fields and defaulting the rest. */
export function sanitize(raw: unknown): SaveState {
  const d = defaultSave();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Record<string, unknown>;
  const s = (r.settings && typeof r.settings === 'object' ? r.settings : {}) as Record<
    string,
    unknown
  >;
  const quality = QUALITY_SETTINGS.includes(s.quality as QualitySetting)
    ? (s.quality as QualitySetting)
    : d.settings.quality;
  return {
    version: 1,
    highScore: num(r.highScore, d.highScore),
    bestDistance: num(r.bestDistance, d.bestDistance),
    totalCoins: num(r.totalCoins, d.totalCoins),
    runs: num(r.runs, d.runs),
    tutorialDone: bool(r.tutorialDone, d.tutorialDone),
    settings: {
      sound: bool(s.sound, d.settings.sound),
      music: bool(s.music, d.settings.music),
      haptics: bool(s.haptics, d.settings.haptics),
      quality,
      tilt: bool(s.tilt, d.settings.tilt),
    },
  };
}

export interface RunResult {
  score: number;
  coins: number;
  distance: number;
}

/**
 * Persistent progress and settings in `localStorage`. Every access is guarded: private
 * browsing, quota errors or corrupt JSON fall back to defaults instead of breaking the game.
 */
export class SaveData {
  state: SaveState;

  constructor(private readonly store: KeyValueStore | null = safeLocalStorage()) {
    this.state = this.load();
  }

  load(): SaveState {
    try {
      const text = this.store?.getItem(SAVE_KEY);
      return text ? sanitize(JSON.parse(text)) : defaultSave();
    } catch {
      return defaultSave();
    }
  }

  save(): boolean {
    try {
      this.store?.setItem(SAVE_KEY, JSON.stringify(this.state));
      return this.store !== null;
    } catch {
      return false;
    }
  }

  /** Records a finished run. Returns true if it set a new high score. */
  recordRun(r: RunResult): boolean {
    const st = this.state;
    const newBest = r.score > st.highScore;
    st.highScore = Math.max(st.highScore, Math.floor(r.score));
    st.bestDistance = Math.max(st.bestDistance, Math.floor(r.distance));
    st.totalCoins += Math.floor(r.coins);
    st.runs++;
    this.save();
    return newBest;
  }

  updateSettings(patch: Partial<Settings>): void {
    this.state.settings = { ...this.state.settings, ...patch };
    this.save();
  }

  setTutorialDone(done: boolean): void {
    this.state.tutorialDone = done;
    this.save();
  }
}

function safeLocalStorage(): KeyValueStore | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

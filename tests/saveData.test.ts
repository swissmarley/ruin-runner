import { describe, expect, it } from 'vitest';
import type { KeyValueStore } from '../src/storage/SaveData';
import { defaultSave, sanitize, SAVE_KEY, SaveData } from '../src/storage/SaveData';

class MemoryStore implements KeyValueStore {
  data = new Map<string, string>();
  getItem(k: string): string | null {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.data.set(k, v);
  }
  removeItem(k: string): void {
    this.data.delete(k);
  }
}

describe('SaveData', () => {
  it('starts with defaults when nothing is stored', () => {
    expect(new SaveData(new MemoryStore()).state).toEqual(defaultSave());
  });

  it('round-trips progress and settings', () => {
    const store = new MemoryStore();
    const a = new SaveData(store);
    expect(a.recordRun({ score: 1234.7, coins: 42, distance: 800.2 })).toBe(true);
    a.updateSettings({ music: false, quality: 'low' });
    a.setTutorialDone(true);

    const b = new SaveData(store);
    expect(b.state.highScore).toBe(1234);
    expect(b.state.totalCoins).toBe(42);
    expect(b.state.bestDistance).toBe(800);
    expect(b.state.runs).toBe(1);
    expect(b.state.tutorialDone).toBe(true);
    expect(b.state.settings).toEqual({
      sound: true,
      music: false,
      haptics: true,
      quality: 'low',
      tilt: false,
    });
  });

  it('keeps the best score and accumulates coins across runs', () => {
    const s = new SaveData(new MemoryStore());
    s.recordRun({ score: 500, coins: 10, distance: 300 });
    expect(s.recordRun({ score: 200, coins: 5, distance: 100 })).toBe(false);
    expect(s.state.highScore).toBe(500);
    expect(s.state.totalCoins).toBe(15);
    expect(s.state.runs).toBe(2);
  });

  it('survives corrupt JSON', () => {
    const store = new MemoryStore();
    store.setItem(SAVE_KEY, '{not json');
    expect(new SaveData(store).state).toEqual(defaultSave());
  });

  it('sanitizes wrong types and unknown values field by field', () => {
    const s = sanitize({
      highScore: 'lots',
      totalCoins: 77,
      runs: -5,
      tutorialDone: 'yes',
      settings: { sound: false, music: 3, quality: 'ultra' },
    });
    expect(s.highScore).toBe(0);
    expect(s.totalCoins).toBe(77);
    expect(s.runs).toBe(0);
    expect(s.tutorialDone).toBe(false);
    expect(s.settings).toEqual({
      sound: false,
      music: true,
      haptics: true,
      quality: 'auto',
      tilt: false,
    });
  });

  it('keeps working when storage throws (private mode, quota)', () => {
    const broken: KeyValueStore = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {},
    };
    const s = new SaveData(broken);
    expect(s.state).toEqual(defaultSave());
    expect(s.save()).toBe(false);
    expect(() => s.recordRun({ score: 1, coins: 1, distance: 1 })).not.toThrow();
  });

  it('works without any storage at all', () => {
    const s = new SaveData(null);
    expect(s.save()).toBe(false);
    s.recordRun({ score: 10, coins: 1, distance: 5 });
    expect(s.state.highScore).toBe(10);
  });
});

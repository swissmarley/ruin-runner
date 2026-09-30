import type { QualitySetting } from '../storage/SaveData';
import type { Renderer } from './Renderer';

export type QualityLevel = 'low' | 'medium' | 'high';
export const QUALITY_LEVELS: readonly QualityLevel[] = ['low', 'medium', 'high'];

export interface QualityPreset {
  maxPixelRatio: number;
  shadows: boolean;
  shadowMapSize: number;
  fogFar: number;
}

export const PRESETS: Record<QualityLevel, QualityPreset> = {
  low: { maxPixelRatio: 1, shadows: false, shadowMapSize: 512, fogFar: 95 },
  medium: { maxPixelRatio: 1.5, shadows: true, shadowMapSize: 512, fogFar: 110 },
  high: { maxPixelRatio: 2, shadows: true, shadowMapSize: 1024, fogFar: 120 },
};

/** Applies a quality level to the renderer (pixel ratio capped by the device and at 2). */
export function applyQuality(renderer: Renderer, level: QualityLevel): void {
  const preset = PRESETS[level];
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(Math.min(dpr, preset.maxPixelRatio));
  renderer.setShadows(preset.shadows, preset.shadowMapSize);
  renderer.setFogFar(preset.fogFar);
}

/** Starting level for "auto": phones start at medium and adapt; desktops start high. */
export function initialLevel(setting: QualitySetting): QualityLevel {
  if (setting !== 'auto') return setting;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  return coarse ? 'medium' : 'high';
}

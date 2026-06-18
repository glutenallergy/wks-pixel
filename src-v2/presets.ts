// ── Presets ──────────────────────────────────────────────
// Save/load named looks to localStorage. Stores settings only (not the source
// image), so a saved look can be applied to any image. Imported icon ids live
// in `symbols`, so they're remembered too (re-fetched on load).

import type { V2State } from './state';

const KEY = 'wks-v2-presets';

// Fields that make up a "look" — everything except the source image identity.
const SAVED_KEYS: (keyof V2State)[] = [
  'gridCols', 'levels', 'invert',
  'style', 'colorMode', 'symbols', 'scatter',
  'paletteMatch', 'dither', 'palette',
  'inkColor', 'bgColor', 'colorDark', 'colorLight',
  'exposure', 'black', 'white', 'gamma',
];

export type PresetSettings = Partial<V2State>;
type PresetMap = Record<string, PresetSettings>;

function readAll(): PresetMap {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}
function writeAll(m: PresetMap): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    /* storage full / unavailable — ignore */
  }
}

/** Extract just the saved "look" fields from a full state. */
export function settingsOf(state: V2State): PresetSettings {
  const out: PresetSettings = {};
  for (const k of SAVED_KEYS) (out as Record<string, unknown>)[k] = state[k];
  return out;
}

export function listPresets(): string[] {
  return Object.keys(readAll()).sort();
}
export function savePreset(name: string, settings: PresetSettings): void {
  const m = readAll();
  m[name] = settings;
  writeAll(m);
}
export function loadPreset(name: string): PresetSettings | null {
  return readAll()[name] ?? null;
}
export function deletePreset(name: string): void {
  const m = readAll();
  delete m[name];
  writeAll(m);
}

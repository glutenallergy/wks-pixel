// ── v2 state ──────────────────────────────────────────────
// Two orthogonal axes drive the whole look:
//   Style  — how a cell is drawn:  Symbols / Halftone / Blocks
//   Color  — where its color comes from:  Mono / Gradient / Palette
// Palette adds fixed-color quantization (nearest-match) + dithering,
// which is what produces the AtX-poster aesthetic.

import { BRAND_BLACK, BRAND_WHITE, BRAND_TEAL, BRAND_VIOLET } from './palette';
import type { Dither } from './dither';
import { pickRandomSymbols } from './symbols';

export type Style = 'symbols' | 'halftone' | 'blocks';
export type ColorMode = 'mono' | 'gradient' | 'palette';
export type PaletteMatch = 'rgb' | 'brightness';
export type { Dither };

export const STYLES: { value: Style; label: string; hint: string }[] = [
  { value: 'symbols', label: 'Symbols', hint: 'Glyph type by tone' },
  { value: 'halftone', label: 'Halftone', hint: 'Dot size by darkness' },
  { value: 'blocks', label: 'Blocks', hint: 'Flat square cells' },
];

export const COLOR_MODES: { value: ColorMode; label: string }[] = [
  { value: 'mono', label: 'Mono' },
  { value: 'gradient', label: 'Gradient' },
  { value: 'palette', label: 'Palette' },
];

export const MATCHES: { value: PaletteMatch; label: string; hint: string }[] = [
  { value: 'rgb', label: 'Photo', hint: "Match each cell's real color" },
  { value: 'brightness', label: 'Brightness', hint: 'Map tone to palette' },
];

export const DITHERS: { value: Dither; label: string }[] = [
  { value: 'none', label: 'Flat' },
  { value: 'ordered', label: 'Ordered' },
  { value: 'diffusion', label: 'Diffusion' },
];

/** Color modes available for a given style (Blocks can't be Mono — it'd be a flat fill). */
export function colorModesFor(style: Style): ColorMode[] {
  return style === 'blocks' ? ['gradient', 'palette'] : ['mono', 'gradient', 'palette'];
}

export interface V2State {
  fileName: string | null;

  // Grid
  gridCols: number; // "Detail" — width in cells; rows follow image aspect

  // Tone posterization (for symbols ramp + gradient banding)
  levels: number; // 2–8
  invert: boolean;

  // The two axes
  style: Style;
  colorMode: ColorMode;

  // Active symbol set (for the 'symbols' style) — native kinds and/or
  // imported icon ids ("icon:prefix:name"). Order IS the ramp (index 0 =
  // darkest band); user can drag to reorder.
  symbols: string[];

  // Scatter: random symbol per cell instead of tone-ordered ramp (presence
  // still follows tone). 'symbols' style only.
  scatter: boolean;

  // Palette config (when colorMode === 'palette')
  paletteMatch: PaletteMatch;
  dither: Dither;
  palette: string[]; // active brand hexes, 2–7

  // Colors
  inkColor: string;   // mono
  bgColor: string;    // canvas background
  colorDark: string;  // gradient dark stop
  colorLight: string; // gradient light stop

  // Tone (optional, hidden by default)
  exposure: number;
  black: number;
  white: number;
  gamma: number;
}

export function createDefaultState(): V2State {
  return {
    fileName: null,
    gridCols: 64,
    levels: 5,
    invert: false,
    style: 'symbols',
    colorMode: 'mono',
    symbols: pickRandomSymbols(3),
    scatter: false,
    paletteMatch: 'rgb',
    dither: 'ordered',
    palette: [BRAND_BLACK, BRAND_VIOLET, BRAND_TEAL, BRAND_WHITE],
    inkColor: BRAND_BLACK,
    bgColor: BRAND_WHITE,
    colorDark: BRAND_VIOLET,
    colorLight: BRAND_TEAL,
    exposure: 0,
    black: 0,
    white: 1,
    gamma: 1,
  };
}

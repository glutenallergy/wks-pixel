import type { SymbolType } from './symbols';
import type { GradientStop, PaletteEntry } from './gradient';
import type { MaskType } from './masks';
import { createDefaultPalette } from './gradient';

export const BLEND_MODES: { value: string; label: string }[] = [
  { value: 'source-over', label: 'Normal' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'screen', label: 'Screen' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'darken', label: 'Darken' },
  { value: 'lighten', label: 'Lighten' },
  { value: 'color-dodge', label: 'Color Dodge' },
  { value: 'color-burn', label: 'Color Burn' },
  { value: 'hard-light', label: 'Hard Light' },
  { value: 'soft-light', label: 'Soft Light' },
  { value: 'difference', label: 'Difference' },
  { value: 'exclusion', label: 'Exclusion' },
];

export type ChannelSource = 'noise' | 'image';

export interface LayerState {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  blendMode: string; // globalCompositeOperation value

  // Per-layer resolution (1-4x)
  resolution: number;

  // Noise
  noiseScale: number;
  noiseSpeed: number;
  noiseOctaves: number;

  // Channel drives (animated vs static noise)
  symbolDriven: boolean;
  scaleDriven: boolean;
  colorDriven: boolean;
  fillDriven: boolean;

  // Channel sources (noise vs image)
  symbolSource: ChannelSource;
  colorSource: ChannelSource;
  scaleSource: ChannelSource;
  fillSource: ChannelSource;

  // Fill
  fillCutoff: number;

  // Scale
  scaleMin: number;
  scaleMax: number;

  // Symbols
  activeSymbols: SymbolType[];

  // Color palette (multi-select solids + gradients)
  colorPalette: PaletteEntry[];

  // Stroke
  strokeWeight: number;

  // Outline / contour
  outlineEnabled: boolean;
  outlineColor: string;
  outlineWidth: number;
  outlineSmooth: number; // 0 = angular, 1 = full Bezier

  // Image brightness range (for 'image' mask mode)
  // Cells where image brightness is in [brightnessMin, brightnessMax] belong to this layer
  brightnessMin: number;
  brightnessMax: number;

  // Per-layer animation time
  time: number;

  // Noise offset to differentiate layers
  noiseOffset: number;

  // Per-layer cell toggles
  toggledCells: Set<string>;
}

export type ImageAspectRatio = '1:1' | '4:3' | '16:9' | '9:16';

export const IMAGE_ASPECT_RATIOS: { value: ImageAspectRatio; label: string; w: number; h: number }[] = [
  { value: '1:1',  label: '1:1',  w: 1,  h: 1 },
  { value: '4:3',  label: '4:3',  w: 4,  h: 3 },
  { value: '16:9', label: '16:9', w: 16, h: 9 },
  { value: '9:16', label: '9:16', w: 9,  h: 16 },
];

export function getImageGridDimensions(gridSize: number, ratio: ImageAspectRatio): { cols: number; rows: number } {
  const r = IMAGE_ASPECT_RATIOS.find(a => a.value === ratio)!;
  if (r.w >= r.h) {
    // Landscape or square — gridSize is the wider dimension (cols)
    return { cols: gridSize, rows: Math.max(1, Math.round(gridSize * r.h / r.w)) };
  } else {
    // Portrait — gridSize is the taller dimension (rows)
    return { cols: Math.max(1, Math.round(gridSize * r.w / r.h)), rows: gridSize };
  }
}

export interface AppState {
  // Global (shared across layers)
  mask: MaskType;
  backgroundColor: string;
  showGrid: boolean;

  // Image source (for 'image' mask type)
  imageElement: HTMLImageElement | null;
  imageGridSize: number;

  // Image framing — cover-fit with pan/scale
  imageAspectRatio: ImageAspectRatio;
  imageScale: number;  // 1 = cover-fit, >1 = zoom in
  imagePanX: number;   // -1 to 1 horizontal offset within overflow
  imagePanY: number;   // -1 to 1 vertical offset within overflow

  // Layers
  layers: LayerState[];

  // Animation
  animating: boolean;

  // Loop mode — uses 4D noise on a circle for seamless looping
  loopEnabled: boolean;
  loopDuration: number; // seconds for one full loop cycle
  loopRadius: number;   // radius of the circle in noise space (affects smoothness)

  // Noise seed (shared)
  seed: number;

  // Image adjustments (levels & exposure)
  imageExposure: number;      // -2 to +2 EV
  imageLevelsBlack: number;   // 0–1 input black point
  imageLevelsWhite: number;   // 0–1 input white point
  imageLevelsGamma: number;   // 0.2–5 midtone gamma
}

let layerIdCounter = 0;

export function createDefaultLayer(name: string): LayerState {
  layerIdCounter++;
  return {
    id: `layer_${layerIdCounter}`,
    name,
    visible: true,
    opacity: 1,
    blendMode: 'source-over',

    resolution: 1,

    noiseScale: 30,
    noiseSpeed: 50,
    noiseOctaves: 2,

    symbolDriven: false,
    scaleDriven: false,
    colorDriven: true,
    fillDriven: false,

    symbolSource: 'noise',
    colorSource: 'noise',
    scaleSource: 'noise',
    fillSource: 'noise',

    fillCutoff: 0.3,
    scaleMin: 0.4,
    scaleMax: 1.0,

    activeSymbols: ['square', 'circle', 'punch'],
    colorPalette: createDefaultPalette(),
    strokeWeight: 1.5,

    outlineEnabled: false,
    outlineColor: '#ffffff',
    outlineWidth: 2,
    outlineSmooth: 1,

    brightnessMin: 0,
    brightnessMax: 1,

    time: 0,
    noiseOffset: layerIdCounter * 97.3,
    toggledCells: new Set(),
  };
}

export function createDefaultState(): AppState {
  return {
    mask: 'full',
    backgroundColor: '#f5f2eb',
    showGrid: true,
    imageElement: null,
    imageGridSize: 50,
    imageAspectRatio: '1:1',
    imageScale: 1,
    imagePanX: 0,
    imagePanY: 0,
    layers: [createDefaultLayer('Layer 1')],
    animating: true,
    loopEnabled: false,
    loopDuration: 4,
    loopRadius: 0.15,
    seed: 42,
    imageExposure: 0,
    imageLevelsBlack: 0,
    imageLevelsWhite: 1,
    imageLevelsGamma: 1,
  };
}

import type { AppState, LayerState } from './state';
import { createDefaultState, createDefaultLayer } from './state';
import { createDefaultPalette } from './gradient';
import type { GradientStop, PaletteEntry } from './gradient';

const STORAGE_KEY = 'wks-grid-presets';
const AUTOSAVE_KEY = 'wks-grid-autosave';

interface SerializedLayer {
  [key: string]: unknown;
  toggledCells?: string[];
}

interface SerializedState {
  mask: string;
  backgroundColor: string;
  showGrid: boolean;
  animating: boolean;
  seed: number;
  imageGridSize?: number;
  loopEnabled?: boolean;
  loopDuration?: number;
  loopRadius?: number;
  imageExposure?: number;
  imageLevelsBlack?: number;
  imageLevelsWhite?: number;
  imageLevelsGamma?: number;
  imageAspectRatio?: string;
  imageScale?: number;
  imagePanX?: number;
  imagePanY?: number;
  layers: SerializedLayer[];
  // Legacy fields (pre per-layer resolution)
  resolution?: number;
  toggledCells?: string[];
}

export function serializeState(state: AppState): SerializedState {
  return {
    mask: state.mask,
    backgroundColor: state.backgroundColor,
    showGrid: state.showGrid,
    animating: state.animating,
    seed: state.seed,
    imageGridSize: state.imageGridSize,
    loopEnabled: state.loopEnabled,
    loopDuration: state.loopDuration,
    loopRadius: state.loopRadius,
    imageExposure: state.imageExposure,
    imageLevelsBlack: state.imageLevelsBlack,
    imageLevelsWhite: state.imageLevelsWhite,
    imageLevelsGamma: state.imageLevelsGamma,
    imageAspectRatio: state.imageAspectRatio,
    imageScale: state.imageScale,
    imagePanX: state.imagePanX,
    imagePanY: state.imagePanY,
    layers: state.layers.map(l => ({
      ...l,
      toggledCells: Array.from(l.toggledCells),
    })),
  };
}

export function deserializeState(data: SerializedState): AppState {
  const defaults = createDefaultState();
  const defaultLayer = createDefaultLayer('_');

  // Handle legacy global resolution/toggledCells
  const legacyRes = data.resolution ?? 1;
  const legacyToggled = data.toggledCells ? new Set(data.toggledCells) : new Set<string>();

  const mask = (data.mask as AppState['mask']) ?? defaults.mask;

  return {
    mask: mask === 'image' && !data.imageGridSize ? 'full' : mask,
    backgroundColor: data.backgroundColor ?? defaults.backgroundColor,
    showGrid: data.showGrid ?? defaults.showGrid,
    imageElement: null, // Can't serialize HTMLImageElement
    imageGridSize: data.imageGridSize ?? defaults.imageGridSize,
    animating: data.animating ?? defaults.animating,
    loopEnabled: data.loopEnabled ?? defaults.loopEnabled,
    loopDuration: data.loopDuration ?? defaults.loopDuration,
    loopRadius: data.loopRadius ?? defaults.loopRadius,
    imageExposure: data.imageExposure ?? defaults.imageExposure,
    imageLevelsBlack: data.imageLevelsBlack ?? defaults.imageLevelsBlack,
    imageLevelsWhite: data.imageLevelsWhite ?? defaults.imageLevelsWhite,
    imageLevelsGamma: data.imageLevelsGamma ?? defaults.imageLevelsGamma,
    imageAspectRatio: (data.imageAspectRatio as AppState['imageAspectRatio']) ?? defaults.imageAspectRatio,
    imageScale: data.imageScale ?? defaults.imageScale,
    imagePanX: data.imagePanX ?? defaults.imagePanX,
    imagePanY: data.imagePanY ?? defaults.imagePanY,
    seed: data.seed ?? defaults.seed,
    layers: (data.layers ?? []).map(l => {
      const toggledArr = (l.toggledCells as string[] | undefined) ?? [];
      const layer: LayerState = {
        ...defaultLayer,
        ...l,
        // Apply legacy resolution if layer doesn't have its own
        resolution: (l.resolution as number) ?? legacyRes,
        toggledCells: new Set(toggledArr),
      };
      // If legacy toggledCells exist and layer has none, apply them
      if (toggledArr.length === 0 && legacyToggled.size > 0) {
        layer.toggledCells = new Set(legacyToggled);
      }
      // Migrate legacy gradientStops → colorPalette
      const legacyStops = (l as Record<string, unknown>).gradientStops as GradientStop[] | undefined;
      if (legacyStops && !l.colorPalette) {
        const palette = createDefaultPalette();
        // Deselect all defaults
        palette.forEach(e => e.selected = false);
        // Add a custom entry with the legacy gradient
        palette.push({
          id: 'migrated',
          name: 'Migrated',
          stops: legacyStops.map(s => ({ ...s })),
          selected: true,
        });
        layer.colorPalette = palette;
      }
      // Ensure colorPalette is always valid
      if (!layer.colorPalette || !Array.isArray(layer.colorPalette) || layer.colorPalette.length === 0) {
        layer.colorPalette = createDefaultPalette();
      }
      return layer;
    }),
  };
}

function getPresetsMap(): Record<string, SerializedState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function setPresetsMap(map: Record<string, SerializedState>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function listPresetNames(): string[] {
  return Object.keys(getPresetsMap());
}

export function savePreset(name: string, state: AppState): void {
  const map = getPresetsMap();
  map[name] = serializeState(state);
  setPresetsMap(map);
}

export function loadPreset(name: string): AppState | null {
  const map = getPresetsMap();
  const data = map[name];
  if (!data) return null;
  return deserializeState(data);
}

export function deletePreset(name: string): void {
  const map = getPresetsMap();
  delete map[name];
  setPresetsMap(map);
}

export function applyState(target: AppState, source: AppState): void {
  target.mask = source.mask;
  target.backgroundColor = source.backgroundColor;
  target.showGrid = source.showGrid;
  target.imageElement = source.imageElement;
  target.imageGridSize = source.imageGridSize;
  target.animating = source.animating;
  target.loopEnabled = source.loopEnabled;
  target.loopDuration = source.loopDuration;
  target.loopRadius = source.loopRadius;
  target.imageExposure = source.imageExposure;
  target.imageLevelsBlack = source.imageLevelsBlack;
  target.imageLevelsWhite = source.imageLevelsWhite;
  target.imageLevelsGamma = source.imageLevelsGamma;
  target.imageAspectRatio = source.imageAspectRatio;
  target.imageScale = source.imageScale;
  target.imagePanX = source.imagePanX;
  target.imagePanY = source.imagePanY;
  target.seed = source.seed;
  target.layers = source.layers;
}

// Auto-save/restore: persists the full app state across page reloads
export function autoSaveState(state: AppState): void {
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(serializeState(state)));
  } catch {
    // Silently fail if localStorage is full
  }
}

export function autoLoadState(): AppState | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    const data: SerializedState = JSON.parse(raw);
    return deserializeState(data);
  } catch {
    return null;
  }
}

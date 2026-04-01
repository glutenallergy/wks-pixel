import type { AppState, LayerState, ChannelSource, PaintSymmetry, PaintTool } from '../state';
import type { SymbolType } from '../symbols';
import { ALL_SYMBOLS } from '../symbols';
import type { GradientStop, PaletteEntry } from '../gradient';
import type { MaskType } from '../masks';
import { createDefaultLayer, createEmptyGrid } from '../state';
import type { ImageAspectRatio } from '../state';
import { createDefaultPalette } from '../gradient';

export type AppAction =
  | { type: 'SET_MASK'; mask: MaskType }
  | { type: 'SET_BACKGROUND'; color: string }
  | { type: 'SET_SHOW_GRID'; show: boolean }
  | { type: 'SET_ANIMATING'; animating: boolean }
  | { type: 'SET_IMAGE'; image: HTMLImageElement | null }
  | { type: 'SET_IMAGE_GRID_SIZE'; size: number }
  | { type: 'ADD_LAYER' }
  | { type: 'REMOVE_LAYER'; layerId: string }
  | { type: 'REORDER_LAYER'; fromIdx: number; toIdx: number }
  | { type: 'UPDATE_LAYER'; layerId: string; updates: Partial<LayerState> }
  | { type: 'SET_LAYER_SYMBOLS'; layerId: string; symbols: SymbolType[] }
  | { type: 'SET_LAYER_PALETTE'; layerId: string; palette: PaletteEntry[] }
  | { type: 'TOGGLE_CELL'; layerId: string; key: string }
  | { type: 'APPLY_STATE'; state: AppState }
  | { type: 'GENERATE_IMAGE_LAYERS'; count: number }
  | { type: 'RANDOMIZE_LAYER'; layerId: string }
  | { type: 'SET_LOOP_ENABLED'; enabled: boolean }
  | { type: 'SET_LOOP_DURATION'; duration: number }
  | { type: 'SET_LOOP_RADIUS'; radius: number }
  | { type: 'SET_IMAGE_EXPOSURE'; value: number }
  | { type: 'SET_IMAGE_LEVELS_BLACK'; value: number }
  | { type: 'SET_IMAGE_LEVELS_WHITE'; value: number }
  | { type: 'SET_IMAGE_LEVELS_GAMMA'; value: number }
  | { type: 'SET_IMAGE_ASPECT_RATIO'; ratio: ImageAspectRatio }
  | { type: 'SET_IMAGE_SCALE'; scale: number }
  | { type: 'SET_IMAGE_PAN_X'; value: number }
  | { type: 'SET_IMAGE_PAN_Y'; value: number }
  | { type: 'SET_PAINT_CELLS'; cells: { row: number; col: number; value: 0 | 1 }[] }
  | { type: 'SET_PAINT_GRID'; grid: number[][] }
  | { type: 'CLEAR_PAINT_GRID' }
  | { type: 'FILL_PAINT_GRID' }
  | { type: 'SET_PAINT_GRID_SIZE'; width: number; height: number }
  | { type: 'SET_PAINT_SYMMETRY'; symmetry: PaintSymmetry }
  | { type: 'SET_PAINT_TOOL'; tool: PaintTool }
  | { type: 'SET_PAINT_BRUSH_SIZE'; size: number }
  | { type: 'SET_CANVAS_SIZE'; width: number; height: number };

const IMAGE_LAYER_PRESETS: {
  name: string;
  symbols: SymbolType[];
  gradient: GradientStop[];
  fillCutoff: number;
  noiseSpeed: number;
}[] = [
  {
    name: 'Shadows',
    symbols: ['square'],
    gradient: [{ position: 0, color: '#000000' }, { position: 1, color: '#1a1a1a' }],
    fillCutoff: 0.0,
    noiseSpeed: 20,
  },
  {
    name: 'Dark Mids',
    symbols: ['circle', 'punch'],
    gradient: [{ position: 0, color: '#333333' }, { position: 1, color: '#666666' }],
    fillCutoff: 0.2,
    noiseSpeed: 40,
  },
  {
    name: 'Light Mids',
    symbols: ['plus', 'star', 'donut'],
    gradient: [{ position: 0, color: '#888888' }, { position: 1, color: '#bbbbbb' }],
    fillCutoff: 0.25,
    noiseSpeed: 60,
  },
  {
    name: 'Highlights',
    symbols: ['smile', 'target'],
    gradient: [{ position: 0, color: '#cccccc' }, { position: 1, color: '#ffffff' }],
    fillCutoff: 0.3,
    noiseSpeed: 30,
  },
];

function generateImageLayers(count: number): LayerState[] {
  const layers: LayerState[] = [];
  for (let i = 0; i < count; i++) {
    const preset = IMAGE_LAYER_PRESETS[i];
    const layer = createDefaultLayer(preset.name);
    layer.brightnessMin = i / count;
    layer.brightnessMax = (i + 1) / count;
    layer.activeSymbols = [...preset.symbols];
    // For image layers, create a single-entry palette with the preset gradient
    const palette = createDefaultPalette();
    // Deselect all defaults, add a custom entry for this preset
    palette.forEach(e => e.selected = false);
    palette.push({
      id: `image-preset-${i}`,
      name: preset.name,
      stops: preset.gradient.map(s => ({ ...s })),
      selected: true,
    });
    layer.colorPalette = palette;
    layer.fillCutoff = preset.fillCutoff;
    layer.noiseSpeed = preset.noiseSpeed;
    layer.noiseScale = 30;
    layer.noiseOctaves = 2;
    layer.colorDriven = true;
    layer.symbolDriven = true;
    layer.scaleDriven = false;
    layer.fillDriven = true;
    layer.fillSource = 'noise';
    layer.colorSource = 'noise';
    layer.symbolSource = 'noise';
    layer.scaleSource = 'noise';
    layers.push(layer);
  }
  return layers;
}

function randomizeLayer(layer: LayerState): LayerState {
  const r = Math.random;

  // Pick 1–4 random symbols
  const shuffled = [...ALL_SYMBOLS].sort(() => r() - 0.5);
  const symbolCount = 1 + Math.floor(r() * 4);
  const activeSymbols = shuffled.slice(0, symbolCount);

  // Randomize which palette entries are selected (1–3)
  const palette = layer.colorPalette.map(e => ({ ...e, selected: false }));
  const paletteCount = 1 + Math.floor(r() * Math.min(3, palette.length));
  const paletteIdxs = [...palette.keys()].sort(() => r() - 0.5).slice(0, paletteCount);
  paletteIdxs.forEach(i => { palette[i] = { ...palette[i], selected: true }; });

  const scaleMin = parseFloat((r() * 0.6).toFixed(2));
  const scaleMax = parseFloat((scaleMin + 0.2 + r() * (1 - scaleMin - 0.2)).toFixed(2));

  return {
    ...layer,
    noiseScale: 1 + Math.floor(r() * 99),
    noiseSpeed: Math.floor(r() * 200),
    noiseOctaves: 1 + Math.floor(r() * 4),
    symbolDriven: r() > 0.5,
    colorDriven: r() > 0.3,
    scaleDriven: r() > 0.5,
    fillDriven: r() > 0.5,
    fillCutoff: parseFloat((r() * 0.6).toFixed(2)),
    scaleMin,
    scaleMax,
    strokeWeight: parseFloat((0.5 + r() * 4.5).toFixed(1)),
    activeSymbols,
    colorPalette: palette,
  };
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_MASK':
      return {
        ...state,
        mask: action.mask,
        layers: state.layers.map(l => ({ ...l, toggledCells: new Set<string>() })),
      };

    case 'SET_BACKGROUND':
      return { ...state, backgroundColor: action.color };

    case 'SET_SHOW_GRID':
      return { ...state, showGrid: action.show };

    case 'SET_ANIMATING':
      return { ...state, animating: action.animating };

    case 'SET_IMAGE':
      return { ...state, imageElement: action.image };

    case 'SET_IMAGE_GRID_SIZE':
      return { ...state, imageGridSize: action.size };

    case 'ADD_LAYER': {
      if (state.layers.length >= 4) return state;
      const newLayer = createDefaultLayer(`Layer ${state.layers.length + 1}`);
      return { ...state, layers: [...state.layers, newLayer] };
    }

    case 'REMOVE_LAYER':
      if (state.layers.length <= 1) return state;
      return { ...state, layers: state.layers.filter(l => l.id !== action.layerId) };

    case 'REORDER_LAYER': {
      const layers = [...state.layers];
      const [moved] = layers.splice(action.fromIdx, 1);
      layers.splice(action.toIdx, 0, moved);
      return { ...state, layers };
    }

    case 'UPDATE_LAYER':
      return {
        ...state,
        layers: state.layers.map(l =>
          l.id === action.layerId ? { ...l, ...action.updates } : l
        ),
      };

    case 'SET_LAYER_SYMBOLS':
      return {
        ...state,
        layers: state.layers.map(l =>
          l.id === action.layerId ? { ...l, activeSymbols: action.symbols } : l
        ),
      };

    case 'SET_LAYER_PALETTE':
      return {
        ...state,
        layers: state.layers.map(l =>
          l.id === action.layerId ? { ...l, colorPalette: action.palette } : l
        ),
      };

    case 'TOGGLE_CELL': {
      return {
        ...state,
        layers: state.layers.map(l => {
          if (l.id !== action.layerId) return l;
          const next = new Set(l.toggledCells);
          if (next.has(action.key)) next.delete(action.key);
          else next.add(action.key);
          return { ...l, toggledCells: next };
        }),
      };
    }

    case 'APPLY_STATE':
      return { ...action.state };

    case 'GENERATE_IMAGE_LAYERS':
      return { ...state, layers: generateImageLayers(action.count) };

    case 'SET_LOOP_ENABLED':
      return {
        ...state,
        loopEnabled: action.enabled,
        // Reset all layer times to 0 when toggling loop mode
        layers: state.layers.map(l => ({ ...l, time: 0 })),
      };

    case 'SET_LOOP_DURATION':
      return { ...state, loopDuration: action.duration };

    case 'SET_LOOP_RADIUS':
      return { ...state, loopRadius: action.radius };

    case 'SET_IMAGE_EXPOSURE':
      return { ...state, imageExposure: action.value };
    case 'SET_IMAGE_LEVELS_BLACK':
      return { ...state, imageLevelsBlack: action.value };
    case 'SET_IMAGE_LEVELS_WHITE':
      return { ...state, imageLevelsWhite: action.value };
    case 'SET_IMAGE_LEVELS_GAMMA':
      return { ...state, imageLevelsGamma: action.value };

    case 'SET_IMAGE_ASPECT_RATIO':
      return { ...state, imageAspectRatio: action.ratio };
    case 'SET_IMAGE_SCALE':
      return { ...state, imageScale: action.scale };
    case 'SET_IMAGE_PAN_X':
      return { ...state, imagePanX: action.value };
    case 'SET_IMAGE_PAN_Y':
      return { ...state, imagePanY: action.value };

    case 'SET_PAINT_CELLS': {
      // Cells already include mirrored positions from the paint hook
      const grid = state.paintGrid.map(r => [...r]);
      const w = state.paintGridWidth;
      const h = state.paintGridHeight;
      for (const cell of action.cells) {
        const { row, col, value } = cell;
        if (row >= 0 && row < h && col >= 0 && col < w) {
          grid[row][col] = value;
        }
      }
      return { ...state, paintGrid: grid };
    }

    case 'CLEAR_PAINT_GRID':
      return { ...state, paintGrid: createEmptyGrid(state.paintGridWidth, state.paintGridHeight) };

    case 'FILL_PAINT_GRID':
      return { ...state, paintGrid: Array.from({ length: state.paintGridHeight }, () => Array(state.paintGridWidth).fill(1)) };

    case 'SET_PAINT_GRID':
      return { ...state, paintGrid: action.grid };

    case 'SET_PAINT_GRID_SIZE':
      return {
        ...state,
        paintGridWidth: action.width,
        paintGridHeight: action.height,
        paintGrid: createEmptyGrid(action.width, action.height),
      };

    case 'SET_PAINT_SYMMETRY':
      return { ...state, paintSymmetry: action.symmetry };

    case 'SET_PAINT_TOOL':
      return { ...state, paintTool: action.tool };

    case 'SET_PAINT_BRUSH_SIZE':
      return { ...state, paintBrushSize: action.size };

    case 'RANDOMIZE_LAYER':
      return {
        ...state,
        layers: state.layers.map(l =>
          l.id === action.layerId ? randomizeLayer(l) : l
        ),
      };

    case 'SET_CANVAS_SIZE':
      return {
        ...state,
        canvasGridWidth: action.width,
        canvasGridHeight: action.height,
        layers: state.layers.map(l => ({ ...l, toggledCells: new Set<string>() })),
      };

    default:
      return state;
  }
}

import { SimplexNoise } from './noise';
import { getMaskData } from './masks';
import { sampleGradient, getSelectedEntries } from './gradient';
import type { PaletteEntry } from './gradient';
import { symbolToSVG, type SymbolType } from './symbols';
import { buildFillGrid, computeContours, contoursToSVG } from './contour';
import type { AppState, LayerState } from './state';
import { getImageGridDimensions } from './state';
import { computeLayerLayout, type CompositingInfo, type LayoutInfo } from './renderer';
import { getBrightness, adjustBrightness } from './image';

export function exportPNG(canvas: HTMLCanvasElement, fileName: string = 'wks-grid.png'): void {
  const link = document.createElement('a');
  link.download = fileName;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

// Noise offsets (same as renderer)
const OFF = {
  color:        { x: 0,    y: 0 },
  symbol:       { x: 7.3,  y: 3.7 },
  scale:        { x: 13.1, y: 11.9 },
  fill:         { x: 19.7, y: 17.3 },
  staticSymbol: { x: 41.2, y: 37.5 },
  staticColor:  { x: 53.6, y: 47.1 },
  staticFill:   { x: 31.4, y: 27.8 },
  palette:      { x: 67.3, y: 59.1 },
  staticPalette:{ x: 73.8, y: 65.4 },
};

// Loop state for export sampling (mirrors renderer approach)
let _exportLoopEnabled = false;
let _exportLoopZ = 0;
let _exportLoopW = 0;

function setExportLoopParams(enabled: boolean, radius: number, phase: number) {
  _exportLoopEnabled = enabled;
  if (enabled) {
    _exportLoopZ = Math.cos(phase * Math.PI * 2) * radius;
    _exportLoopW = Math.sin(phase * Math.PI * 2) * radius;
  }
}

function sample(
  n: SimplexNoise, col: number, row: number, freq: number,
  time: number, ox: number, oy: number, octaves: number, ts: number = 1,
): number {
  let raw: number;
  if (_exportLoopEnabled) {
    raw = n.fbm4D(col * freq + ox, row * freq + oy, _exportLoopZ * ts, _exportLoopW * ts, octaves);
  } else {
    raw = n.fbm3D(col * freq + ox, row * freq + oy, time * ts, octaves);
  }
  return Math.max(0, Math.min(1, (raw + 1) / 2));
}

// Map Canvas2D composite op to CSS mix-blend-mode
function blendToCSS(blend: string): string {
  if (blend === 'source-over') return 'normal';
  return blend;
}

function layerUsesImage(layer: LayerState): boolean {
  return layer.fillSource === 'image' ||
         layer.colorSource === 'image' ||
         layer.symbolSource === 'image' ||
         layer.scaleSource === 'image';
}

function renderLayerSVG(
  layer: LayerState,
  layout: LayoutInfo,
  state: AppState,
  n: SimplexNoise,
  maskLookup: Uint8Array,
  brightness: Float32Array | null,
): string {
  const { totalCols, totalRows, cellSize, padding, baseCols } = layout;
  const maxDim = Math.max(totalCols, totalRows);
  const freq = layer.noiseScale / (10 * maxDim);
  const lo = layer.noiseOffset;
  const loY = lo * 0.7;
  const contentCols = baseCols * layer.resolution;

  let out = '';

  for (let row = 0; row < totalRows; row++) {
    for (let col = 0; col < totalCols; col++) {
      if (!maskLookup[row * totalCols + col]) continue;

      // Image brightness at this cell
      let imgVal = 0.5;
      if (brightness) {
        const maskCol = col - padding;
        const maskRow = row - padding;
        if (maskCol >= 0 && maskRow >= 0 && maskCol < contentCols) {
          const idx = maskRow * contentCols + maskCol;
          if (idx >= 0 && idx < brightness.length) {
            imgVal = brightness[idx];
          }
        }
      }

      // Fill
      let fillValue: number;
      if (layer.fillSource === 'image' && brightness) {
        fillValue = imgVal;
      } else if (layer.fillDriven) {
        fillValue = sample(n, col, row, freq, layer.time, OFF.fill.x + lo, OFF.fill.y + loY, layer.noiseOctaves, 1.1);
      } else {
        fillValue = sample(n, col, row, freq, 0, OFF.staticFill.x + lo, OFF.staticFill.y + loY, layer.noiseOctaves);
      }
      if (fillValue < layer.fillCutoff) continue;

      // Palette entry selection
      const selectedEntries = getSelectedEntries(layer.colorPalette);
      if (selectedEntries.length === 0) continue;
      let entry: PaletteEntry;
      if (selectedEntries.length === 1) {
        entry = selectedEntries[0];
      } else {
        let palValue: number;
        if (layer.colorDriven) {
          palValue = sample(n, col, row, freq, layer.time, OFF.palette.x + lo, OFF.palette.y + loY, layer.noiseOctaves);
        } else {
          palValue = sample(n, col, row, freq, 0, OFF.staticPalette.x + lo, OFF.staticPalette.y + loY, layer.noiseOctaves);
        }
        entry = selectedEntries[Math.min(Math.floor(palValue * selectedEntries.length), selectedEntries.length - 1)];
      }

      // Color (sample within selected entry's gradient)
      let colorValue: number;
      if (layer.colorSource === 'image' && brightness) {
        colorValue = imgVal;
      } else if (layer.colorDriven) {
        colorValue = sample(n, col, row, freq, layer.time, OFF.color.x + lo, OFF.color.y + loY, layer.noiseOctaves);
      } else {
        colorValue = sample(n, col, row, freq, 0, OFF.staticColor.x + lo, OFF.staticColor.y + loY, layer.noiseOctaves);
      }
      const color = sampleGradient(entry.stops, colorValue);

      // Symbol
      let sym: SymbolType;
      const syms = layer.activeSymbols;
      if (syms.length <= 1) {
        sym = syms[0] || 'square';
      } else {
        let symValue: number;
        if (layer.symbolSource === 'image' && brightness) {
          symValue = imgVal;
        } else if (layer.symbolDriven) {
          symValue = sample(n, col, row, freq, layer.time, OFF.symbol.x + lo, OFF.symbol.y + loY, layer.noiseOctaves);
        } else {
          symValue = sample(n, col, row, freq, 0, OFF.staticSymbol.x + lo, OFF.staticSymbol.y + loY, layer.noiseOctaves);
        }
        sym = syms[Math.min(Math.floor(symValue * syms.length), syms.length - 1)];
      }

      // Scale
      let scale: number;
      if (layer.scaleDriven || (layer.scaleSource === 'image' && brightness)) {
        let scaleValue: number;
        if (layer.scaleSource === 'image' && brightness) {
          scaleValue = imgVal;
        } else {
          scaleValue = sample(n, col, row, freq, layer.time, OFF.scale.x + lo, OFF.scale.y + loY, layer.noiseOctaves, 0.9);
        }
        scale = layer.scaleMin + scaleValue * (layer.scaleMax - layer.scaleMin);
      } else {
        scale = layer.scaleMax;
      }

      const cx = col * cellSize + cellSize / 2;
      const cy = row * cellSize + cellSize / 2;
      out += symbolToSVG(sym, cx, cy, cellSize, color, layer.strokeWeight, scale) + '\n';
    }
  }

  return out;
}

export function exportSVG(state: AppState, comp: CompositingInfo): void {
  const { compositingW, compositingH, baseCols, baseRows, dpr } = comp;
  const n = new SimplexNoise(state.seed);
  const w = compositingW;
  const h = compositingH;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">\n`;
  svg += `<rect width="${w}" height="${h}" fill="${state.backgroundColor}"/>\n`;

  // Set loop params for export (matches current animation state)
  if (state.loopEnabled) {
    setExportLoopParams(true, state.loopRadius, 0); // Export at phase 0
  } else {
    setExportLoopParams(false, 0, 0);
  }

  for (const layer of state.layers) {
    if (!layer.visible) continue;

    // Update loop phase per-layer if in loop mode
    if (state.loopEnabled) {
      setExportLoopParams(true, state.loopRadius, layer.time);
    }

    const layerLayout = computeLayerLayout(layer, baseCols, baseRows, compositingW, compositingH, dpr);
    const { totalCols, totalRows, padding } = layerLayout;
    const contentCols = baseCols * layer.resolution;

    // Get brightness (needed for image mask AND image channel sources)
    let brightness: Float32Array | null = null;
    if (state.imageElement && (state.mask === 'image' || layerUsesImage(layer))) {
      const contentW = baseCols * layer.resolution;
      const contentH = baseRows * layer.resolution;
      const raw = getBrightness(state.imageElement, contentW, contentH, state.imageScale, state.imagePanX, state.imagePanY);
      brightness = adjustBrightness(
        raw,
        state.imageExposure,
        state.imageLevelsBlack,
        state.imageLevelsWhite,
        state.imageLevelsGamma,
      );
    }

    // Build mask lookup for this layer
    const imgDim = state.mask === 'image' ? getImageGridDimensions(state.imageGridSize, state.imageAspectRatio) : undefined;
    const maskData = getMaskData(state.mask, state.imageGridSize, imgDim?.cols, imgDim?.rows);
    const maskLookup = new Uint8Array(totalCols * totalRows);
    for (let row = 0; row < totalRows; row++) {
      for (let col = 0; col < totalCols; col++) {
        const inPadding = col < padding || col >= totalCols - padding ||
                          row < padding || row >= totalRows - padding;
        let inMask = false;
        if (!inPadding) {
          if (state.mask === 'image' && brightness) {
            const maskCol = col - padding;
            const maskRow = row - padding;
            if (maskCol >= 0 && maskRow >= 0 && maskCol < contentCols) {
              const idx = maskRow * contentCols + maskCol;
              if (idx >= 0 && idx < brightness.length) {
                const b = brightness[idx];
                inMask = b >= layer.brightnessMin && b <= layer.brightnessMax;
              }
            }
          } else if (state.mask === 'full') {
            inMask = true;
          } else {
            const bCol = Math.floor((col - padding) / layer.resolution);
            const bRow = Math.floor((row - padding) / layer.resolution);
            if (bRow >= 0 && bRow < baseRows && bCol >= 0 && bCol < baseCols) {
              inMask = maskData[bRow][bCol] === 1;
            }
          }
        }
        const key = `${col},${row}`;
        if (layer.toggledCells.has(key)) inMask = !inMask;
        maskLookup[row * totalCols + col] = inMask ? 1 : 0;
      }
    }

    const blend = blendToCSS(layer.blendMode);
    svg += `<g style="mix-blend-mode:${blend};opacity:${layer.opacity}">\n`;
    svg += renderLayerSVG(layer, layerLayout, state, n, maskLookup, brightness);

    // Contour outlines
    if (layer.outlineEnabled) {
      const fillGrid = buildFillGrid(layer, layerLayout, maskLookup, n);
      const contours = computeContours(fillGrid, totalCols, totalRows);
      svg += contoursToSVG(contours, layerLayout.cellSize, layer);
    }

    svg += `</g>\n`;
  }

  svg += '</svg>';

  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = 'wks-grid.svg';
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

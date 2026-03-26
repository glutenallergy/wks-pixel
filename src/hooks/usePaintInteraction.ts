import { useEffect, useRef, useCallback } from 'react';
import type { AppState, LayerState } from '../state';
import type { AppAction } from '../lib/actions';
import type { CompositingInfo } from '../renderer';
import { computeLayerLayout } from '../renderer';

/**
 * Bresenham line algorithm — returns all grid cells between two points.
 */
function bresenhamLine(c0: number, r0: number, c1: number, r1: number): { col: number; row: number }[] {
  const cells: { col: number; row: number }[] = [];
  let dx = Math.abs(c1 - c0);
  let dy = Math.abs(r1 - r0);
  const sx = c0 < c1 ? 1 : -1;
  const sy = r0 < r1 ? 1 : -1;
  let err = dx - dy;
  let c = c0, r = r0;

  while (true) {
    cells.push({ col: c, row: r });
    if (c === c1 && r === r1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; c += sx; }
    if (e2 < dx) { err += dx; r += sy; }
  }
  return cells;
}

interface UsePaintInteractionProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  compRef: React.MutableRefObject<CompositingInfo | null>;
  stateRef: React.MutableRefObject<AppState>;
  dispatch: React.Dispatch<AppAction>;
}

export function usePaintInteraction({ canvasRef, compRef, stateRef, dispatch }: UsePaintInteractionProps) {
  const paintingRef = useRef(false);
  const lastCellRef = useRef<{ col: number; row: number } | null>(null);
  const strokeCellsRef = useRef<{ row: number; col: number; value: 0 | 1 }[]>([]);
  // Track current hover position for cursor preview
  const hoverCellRef = useRef<{ col: number; row: number } | null>(null);

  /**
   * Convert pointer event coordinates to base grid (col, row).
   * Uses the same math as App.tsx handleCanvasClick — proven correct.
   */
  const canvasToGrid = useCallback((e: PointerEvent | MouseEvent): { col: number; row: number } | null => {
    const canvas = canvasRef.current;
    const comp = compRef.current;
    const state = stateRef.current;
    if (!canvas || !comp || state.mask !== 'paint') return null;

    const { baseCols, baseRows, compositingW, compositingH, dpr, maxRes } = comp;

    // Use maxRes layout (same as grid overlay) to match visual grid
    const layout = computeLayerLayout(
      { resolution: maxRes } as LayerState,
      baseCols, baseRows, compositingW, compositingH, dpr,
    );

    const rect = canvas.getBoundingClientRect();
    // Scale from CSS pixels to canvas logical pixels
    const sx = canvas.width / dpr / rect.width;
    const sy = canvas.height / dpr / rect.height;
    const px = (e.clientX - rect.left) * sx;
    const py = (e.clientY - rect.top) * sy;

    // Convert to subdivided grid coordinates, subtract padding
    const gridCol = Math.floor(px / layout.cellSize) - layout.padding;
    const gridRow = Math.floor(py / layout.cellSize) - layout.padding;

    // Map from subdivided grid back to base grid
    const bCol = Math.floor(gridCol / maxRes);
    const bRow = Math.floor(gridRow / maxRes);

    if (bCol >= 0 && bCol < baseCols && bRow >= 0 && bRow < baseRows) {
      return { col: bCol, row: bRow };
    }
    return null;
  }, [canvasRef, compRef, stateRef]);

  /** Record a single cell into the stroke (for later dispatch) */
  const recordCell = (row: number, col: number, value: 0 | 1) => {
    strokeCellsRef.current.push({ row, col, value });
  };

  /** Apply brush at a center cell — expands based on brushSize */
  const applyBrush = useCallback((centerCol: number, centerRow: number) => {
    const state = stateRef.current;
    const grid = state.paintGrid;
    const value: 0 | 1 = state.paintTool === 'pen' ? 1 : 0;
    const w = state.paintGridWidth;
    const h = state.paintGridHeight;
    const size = state.paintBrushSize;
    const offset = Math.floor(size / 2);

    for (let dr = 0; dr < size; dr++) {
      for (let dc = 0; dc < size; dc++) {
        const row = centerRow - offset + dr;
        const col = centerCol - offset + dc;
        if (row < 0 || row >= h || col < 0 || col >= w) continue;

        // Direct mutation for immediate visual feedback + record ALL cells for dispatch
        grid[row][col] = value;
        recordCell(row, col, value);

        if (state.paintSymmetry === 'mirror-x' || state.paintSymmetry === 'quad') {
          const mc = w - 1 - col;
          if (mc >= 0 && mc < w) { grid[row][mc] = value; recordCell(row, mc, value); }
        }
        if (state.paintSymmetry === 'mirror-y' || state.paintSymmetry === 'quad') {
          const mr = h - 1 - row;
          if (mr >= 0 && mr < h) { grid[mr][col] = value; recordCell(mr, col, value); }
        }
        if (state.paintSymmetry === 'quad') {
          const mr = h - 1 - row;
          const mc = w - 1 - col;
          if (mr >= 0 && mr < h && mc >= 0 && mc < w) { grid[mr][mc] = value; recordCell(mr, mc, value); }
        }
      }
    }
  }, [stateRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onPointerDown = (e: PointerEvent) => {
      if (stateRef.current.mask !== 'paint') return;
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      paintingRef.current = true;
      strokeCellsRef.current = [];

      const cell = canvasToGrid(e);
      if (cell) {
        lastCellRef.current = cell;
        applyBrush(cell.col, cell.row);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const state = stateRef.current;
      if (state.mask !== 'paint') return;

      // Always update hover for cursor preview
      const cell = canvasToGrid(e);
      hoverCellRef.current = cell;
      // Store hover cell on state for renderer to read
      (state as any)._paintHoverCell = cell;

      if (!paintingRef.current) return;
      if (!cell) return;

      const last = lastCellRef.current;
      if (last && (last.col !== cell.col || last.row !== cell.row)) {
        const line = bresenhamLine(last.col, last.row, cell.col, cell.row);
        for (let i = 1; i < line.length; i++) {
          applyBrush(line[i].col, line[i].row);
        }
      } else if (!last) {
        applyBrush(cell.col, cell.row);
      }

      lastCellRef.current = cell;
    };

    const onPointerUp = (_e: PointerEvent) => {
      if (!paintingRef.current) return;
      paintingRef.current = false;
      lastCellRef.current = null;

      // Dispatch a snapshot of the mutated grid to sync React state.
      // This avoids race conditions between direct mutations and reducer state.
      const grid = stateRef.current.paintGrid;
      dispatch({ type: 'SET_PAINT_GRID', grid: grid.map(r => [...r]) });
      strokeCellsRef.current = [];
    };

    const onPointerLeave = () => {
      hoverCellRef.current = null;
      const state = stateRef.current;
      (state as any)._paintHoverCell = null;
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerLeave);

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerLeave);
    };
  }, [canvasRef, canvasToGrid, applyBrush, dispatch, stateRef]);
}

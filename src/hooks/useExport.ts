import { useCallback } from 'react';
import type { AppState } from '../state';
import type { CompositingInfo } from '../renderer';
import { exportPNG, exportSVG } from '../export';

export function useExport(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  stateRef: React.MutableRefObject<AppState>,
  compRef: React.MutableRefObject<CompositingInfo | null>,
) {
  const handleExportPNG = useCallback(() => {
    if (canvasRef.current) exportPNG(canvasRef.current);
  }, [canvasRef]);

  const handleExportSVG = useCallback(() => {
    const comp = compRef.current;
    if (comp) exportSVG(stateRef.current, comp);
  }, [stateRef, compRef]);

  return { exportPNG: handleExportPNG, exportSVG: handleExportSVG };
}

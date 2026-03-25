import { useRef, useState, useCallback } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useAppState } from './hooks/useAppState';
import { useCanvasRenderer } from './hooks/useCanvasRenderer';
import { useExport } from './hooks/useExport';
import { CanvasView } from './components/CanvasView';
import { Panel } from './components/Panel';
import { computeLayerLayout } from './renderer';
import { exportVideo } from './videoExport';

export default function App() {
  const { state, dispatch, stateRef, needsResize } = useAppState();
  const [videoExporting, setVideoExporting] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);

  const compRef = useCanvasRenderer(canvasRef, wrapperRef, stateRef, needsResize, badgeRef);
  const { exportPNG, exportSVG } = useExport(canvasRef, stateRef, compRef);

  const handleExportVideo = useCallback(async () => {
    const canvas = canvasRef.current;
    const comp = compRef.current;
    if (!canvas || !comp || videoExporting) return;

    setVideoExporting(true);
    setVideoProgress(0);
    try {
      await exportVideo(canvas, stateRef.current, comp, {
        fps: 30,
        onProgress: setVideoProgress,
      });
    } catch (err) {
      console.error('Video export failed:', err);
    } finally {
      setVideoExporting(false);
      setVideoProgress(0);
    }
  }, [canvasRef, compRef, stateRef, videoExporting]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const comp = compRef.current;
    const canvas = canvasRef.current;
    if (!comp || !canvas) return;

    const currentState = stateRef.current;
    const topLayer = [...currentState.layers].reverse().find(l => l.visible);
    if (!topLayer) return;

    const layerLayout = computeLayerLayout(
      topLayer, comp.baseCols, comp.baseRows,
      comp.compositingW, comp.compositingH, comp.dpr,
    );

    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / comp.dpr / rect.width;
    const sy = canvas.height / comp.dpr / rect.height;
    const col = Math.floor((e.clientX - rect.left) * sx / layerLayout.cellSize);
    const row = Math.floor((e.clientY - rect.top) * sy / layerLayout.cellSize);

    if (col >= 0 && col < layerLayout.totalCols && row >= 0 && row < layerLayout.totalRows) {
      const key = `${col},${row}`;
      // Mutate directly on stateRef for immediate visual feedback
      if (topLayer.toggledCells.has(key)) topLayer.toggledCells.delete(key);
      else topLayer.toggledCells.add(key);
    }
  }, [compRef, stateRef]);

  return (
    <TooltipProvider>
      <div className="flex h-screen w-screen overflow-hidden">
        <Panel
          state={state}
          dispatch={dispatch}
          onExportPNG={exportPNG}
          onExportSVG={exportSVG}
          onExportVideo={handleExportVideo}
          videoExporting={videoExporting}
          videoProgress={videoProgress}
        />
        <CanvasView
          canvasRef={canvasRef}
          wrapperRef={wrapperRef}
          badgeRef={badgeRef}
          onCanvasClick={handleCanvasClick}
        />
      </div>
    </TooltipProvider>
  );
}

import { forwardRef } from 'react';

interface CanvasViewProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  wrapperRef: React.RefObject<HTMLDivElement | null>;
  badgeRef: React.RefObject<HTMLDivElement | null>;
  onCanvasClick: (e: React.MouseEvent<HTMLCanvasElement>) => void;
}

export function CanvasView({ canvasRef, wrapperRef, badgeRef, onCanvasClick }: CanvasViewProps) {
  return (
    <div
      ref={wrapperRef}
      className="flex-1 flex items-center justify-center relative overflow-hidden"
      style={{ backgroundColor: 'var(--background)' }}
    >
      <canvas
        ref={canvasRef}
        onClick={onCanvasClick}
        className="cursor-crosshair"
      />
      <div
        ref={badgeRef}
        className="absolute bottom-3 right-3 bg-black/70 text-muted-foreground font-mono text-[10px] px-2 py-1 rounded-sm pointer-events-none"
      />
    </div>
  );
}

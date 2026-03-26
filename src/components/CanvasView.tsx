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
        className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-sm text-foreground/50 text-[10px] px-2.5 py-1 rounded pointer-events-none tabular-nums tracking-wide"
      />
    </div>
  );
}

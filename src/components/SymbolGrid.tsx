import { useRef, useEffect } from 'react';
import { Toggle } from '@/components/ui/toggle';
import { ALL_SYMBOLS, SYMBOL_LABELS, drawSymbolPreview, type SymbolType } from '../symbols';

interface SymbolGridProps {
  activeSymbols: SymbolType[];
  onChange: (symbols: SymbolType[]) => void;
}

function SymbolButton({ type, active, onToggle }: {
  type: SymbolType;
  active: boolean;
  onToggle: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      drawSymbolPreview(canvasRef.current, type, active);
    }
  }, [type, active]);

  return (
    <Toggle
      pressed={active}
      onPressedChange={onToggle}
      className="aspect-square p-1.5 h-11 w-11 rounded-md border border-transparent aria-pressed:border-primary/40 aria-pressed:bg-primary/5"
      title={SYMBOL_LABELS[type]}
    >
      <canvas ref={canvasRef} width={32} height={32} className="w-full h-full" />
    </Toggle>
  );
}

export function SymbolGrid({ activeSymbols, onChange }: SymbolGridProps) {
  const handleToggle = (sym: SymbolType) => {
    const idx = activeSymbols.indexOf(sym);
    if (idx >= 0) {
      if (activeSymbols.length > 1) {
        onChange(activeSymbols.filter(s => s !== sym));
      }
    } else {
      onChange([...activeSymbols, sym]);
    }
  };

  return (
    <div className="grid grid-cols-4 gap-1.5">
      {ALL_SYMBOLS.map(sym => (
        <SymbolButton
          key={sym}
          type={sym}
          active={activeSymbols.includes(sym)}
          onToggle={() => handleToggle(sym)}
        />
      ))}
    </div>
  );
}

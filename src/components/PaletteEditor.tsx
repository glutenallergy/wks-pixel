import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { gradientToCSS } from '../gradient';
import type { GradientStop, PaletteEntry } from '../gradient';

interface PaletteEditorProps {
  palette: PaletteEntry[];
  onChange: (palette: PaletteEntry[]) => void;
}

/** Inline stop editor for a single gradient entry */
function StopEditor({
  entry,
  onChangeStops,
}: {
  entry: PaletteEntry;
  onChangeStops: (stops: GradientStop[]) => void;
}) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const dragRef = useRef(-1);
  const barRef = useRef<HTMLDivElement>(null);
  const stops = entry.stops;
  const safeIdx = Math.min(selectedIdx, stops.length - 1);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragRef.current < 0 || !barRef.current) return;
      const rect = barRef.current.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const next = stops.map((s, i) =>
        i === dragRef.current ? { ...s, position: pos } : s
      );
      onChangeStops(next);
    };
    const onUp = () => { dragRef.current = -1; };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [stops, onChangeStops]);

  const handleBarClick = (e: React.MouseEvent) => {
    if (dragRef.current >= 0 || !barRef.current) return;
    const rect = barRef.current.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    if (stops.some(s => Math.abs(s.position - pos) < 0.03)) return;
    const next = [...stops, { position: pos, color: '#ffffff' }];
    onChangeStops(next);
    setSelectedIdx(next.length - 1);
  };

  const handleRemove = () => {
    if (stops.length <= 2) return;
    const next = stops.filter((_, i) => i !== safeIdx);
    onChangeStops(next);
    setSelectedIdx(Math.min(safeIdx, next.length - 1));
  };

  return (
    <div className="space-y-2 pl-2 border-l-2 border-primary/20 ml-1">
      {/* Gradient bar */}
      <div
        ref={barRef}
        className="h-5 rounded relative cursor-crosshair border border-border"
        style={{ background: gradientToCSS(stops) }}
        onClick={handleBarClick}
      >
        {stops.map((stop, i) => (
          <div
            key={i}
            className={`absolute top-0 h-full w-2 -translate-x-1/2 rounded-sm border-2 cursor-grab transition-colors ${
              i === safeIdx ? 'border-white shadow-sm' : 'border-white/40'
            }`}
            style={{
              left: `${stop.position * 100}%`,
              backgroundColor: stop.color,
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setSelectedIdx(i);
              dragRef.current = i;
            }}
          />
        ))}
      </div>
      {/* Stop controls */}
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={stops[safeIdx]?.color ?? '#000000'}
          onChange={(e) => {
            const next = stops.map((s, i) =>
              i === safeIdx ? { ...s, color: e.target.value } : s
            );
            onChangeStops(next);
          }}
          className="h-6 w-7 rounded border border-border bg-transparent cursor-pointer p-0"
        />
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {stops.length} stops
        </span>
        <Button
          variant="outline"
          size="xs"
          className="ml-auto text-[10px]"
          onClick={handleRemove}
          disabled={stops.length <= 2}
        >
          Remove
        </Button>
      </div>
    </div>
  );
}

export function PaletteEditor({ palette, onChange }: PaletteEditorProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const solids = palette.filter(e => e.id.startsWith('solid-'));
  const gradients = palette.filter(e => e.id.startsWith('grad-'));
  const custom = palette.filter(e => !e.id.startsWith('solid-') && !e.id.startsWith('grad-'));

  const selectedCount = palette.filter(e => e.selected).length;

  const toggleEntry = (id: string) => {
    const entry = palette.find(e => e.id === id);
    if (!entry) return;
    if (entry.selected && selectedCount <= 1) return;
    const next = palette.map(e =>
      e.id === id ? { ...e, selected: !e.selected } : e
    );
    onChange(next);
  };

  const updateEntryStops = (id: string, stops: GradientStop[]) => {
    const next = palette.map(e =>
      e.id === id ? { ...e, stops } : e
    );
    onChange(next);
  };

  const isSolid = (entry: PaletteEntry) =>
    entry.stops.length === 2 && entry.stops[0].color === entry.stops[1].color;

  const renderSwatchGrid = (entries: PaletteEntry[], cols: string) => (
    <div className={`grid ${cols} gap-2`}>
      {entries.map(entry => (
        <div key={entry.id}>
          <button
            className={`h-7 w-full rounded border-2 transition-all cursor-pointer relative ${
              entry.selected
                ? 'border-white/80 ring-1 ring-primary/30 shadow-sm'
                : 'border-transparent opacity-40 hover:opacity-70'
            }`}
            style={{ background: gradientToCSS(entry.stops) }}
            title={entry.name}
            onClick={() => toggleEntry(entry.id)}
          >
            {entry.selected && (
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round"
                    style={{ color: entry.id.startsWith('solid-') && isLightColor(entry.stops[0].color) ? '#000' : '#fff' }} />
                </svg>
              </div>
            )}
          </button>
          {/* Expand/collapse for stop editing (gradients & custom only) */}
          {entry.selected && !entry.id.startsWith('solid-') && (
            <div className="mt-1.5">
              <button
                className="text-[10px] text-muted-foreground hover:text-foreground transition-colors w-full text-left"
                onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
              >
                {expandedId === entry.id ? '- Edit stops' : '+ Edit stops'}
                {!isSolid(entry) && entry.stops.length > 2 && (
                  <span className="text-primary/50 ml-1">({entry.stops.length})</span>
                )}
              </button>
              {expandedId === entry.id && (
                <div className="mt-1.5">
                  <StopEditor
                    entry={entry}
                    onChangeStops={(stops) => updateEntryStops(entry.id, stops)}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Solid colors */}
      <div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Solids</div>
        {renderSwatchGrid(solids, 'grid-cols-4')}
      </div>

      {/* Gradients */}
      <div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Gradients</div>
        {renderSwatchGrid(gradients, 'grid-cols-3')}
      </div>

      {/* Custom entries */}
      {custom.length > 0 && (
        <div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Custom</div>
          {renderSwatchGrid(custom, 'grid-cols-3')}
        </div>
      )}
    </div>
  );
}

function isLightColor(hex: string): boolean {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 160;
}

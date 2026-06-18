import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createDefaultState,
  STYLES,
  COLOR_MODES,
  MATCHES,
  DITHERS,
  colorModesFor,
  type V2State,
  type Style,
  type ColorMode,
} from './state';
import { loadImage } from './image';
import { renderToCanvas, renderPreview } from './render';
import { symbolSVG, SYMBOLS } from './symbols';
import { exportSVG, exportPNG } from './exportArt';
import { BRAND_SWATCHES } from './palette';
import { searchIcons, loadIcon, isIcon, iconRef, iconSvgUrl, setOnIconReady, iconAsImage } from './iconCache';
import { listPresets, savePreset, loadPreset, deletePreset, settingsOf } from './presets';

const STAGE_PAD = 48;

export default function App() {
  const [state, setState] = useState<V2State>(createDefaultState);
  const [imgVersion, setImgVersion] = useState(0);
  const [dims, setDims] = useState<{ cols: number; rows: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const set = useCallback(<K extends keyof V2State>(key: K, value: V2State[K]) => {
    setState((s) => ({ ...s, [key]: value }));
  }, []);

  const setStyle = useCallback((style: Style) => {
    setState((s) => {
      const allowed = colorModesFor(style);
      const colorMode = allowed.includes(s.colorMode) ? s.colorMode : allowed[0];
      return { ...s, style, colorMode };
    });
  }, []);

  const toggleSymbol = useCallback((kind: string) => {
    setState((s) => {
      const has = s.symbols.includes(kind);
      if (has) {
        if (s.symbols.length <= 1) return s; // keep at least 1
        return { ...s, symbols: s.symbols.filter((k) => k !== kind) };
      }
      return { ...s, symbols: [...s.symbols, kind] };
    });
  }, []);

  // Add an imported icon to the symbol set (and kick off its fetch).
  const addIcon = useCallback((id: string) => {
    loadIcon(id);
    setState((s) => (s.symbols.includes(id) ? s : { ...s, symbols: [...s.symbols, id] }));
  }, []);

  // Re-render when an icon finishes loading/rasterizing (async).
  const [iconTick, setIconTick] = useState(0);
  useEffect(() => {
    setOnIconReady(() => setIconTick((t) => t + 1));
  }, []);

  // Drag-reorder the symbol ramp (order = dark → light).
  const symDragIdx = useRef<number | null>(null);
  const moveSymbol = useCallback((from: number, to: number) => {
    setState((s) => {
      if (from === to || from < 0 || to < 0 || from >= s.symbols.length || to >= s.symbols.length) return s;
      const arr = [...s.symbols];
      const [m] = arr.splice(from, 1);
      arr.splice(to, 0, m);
      return { ...s, symbols: arr };
    });
  }, []);

  // Use an icon (rasterized) as the canvas source instead of a photo.
  const [sourceMode, setSourceMode] = useState<'upload' | 'icon'>('upload');
  const setIconSource = useCallback(async (id: string) => {
    const img = await iconAsImage(id);
    if (!img) return;
    imgRef.current = img;
    setImgVersion((v) => v + 1);
    setState((s) => ({ ...s, fileName: iconRef(id) }));
  }, []);

  // Presets
  const [presetNames, setPresetNames] = useState<string[]>(() => listPresets());
  const [presetName, setPresetName] = useState('');
  const refreshPresets = useCallback(() => setPresetNames(listPresets()), []);
  const handleSavePreset = useCallback(() => {
    const name = presetName.trim();
    if (!name) return;
    savePreset(name, settingsOf(state));
    setPresetName('');
    refreshPresets();
  }, [presetName, state, refreshPresets]);
  const handleLoadPreset = useCallback((name: string) => {
    const preset = loadPreset(name);
    if (!preset) return;
    (preset.symbols ?? []).filter(isIcon).forEach((id) => loadIcon(id));
    setState((s) => ({ ...s, ...preset, fileName: s.fileName }));
  }, []);
  const handleDeletePreset = useCallback((name: string) => {
    deletePreset(name);
    refreshPresets();
  }, [refreshPresets]);

  const togglePaletteColor = useCallback((hex: string) => {
    setState((s) => {
      const has = s.palette.some((h) => h.toLowerCase() === hex.toLowerCase());
      if (has) {
        if (s.palette.length <= 2) return s; // keep at least 2
        return { ...s, palette: s.palette.filter((h) => h.toLowerCase() !== hex.toLowerCase()) };
      }
      return { ...s, palette: [...s.palette, hex] }; // append — preserves user order
    });
  }, []);

  const dragIdx = useRef<number | null>(null);
  const movePalette = useCallback((from: number, to: number) => {
    setState((s) => {
      if (from === to || from < 0 || to < 0 || from >= s.palette.length || to >= s.palette.length) return s;
      const pal = [...s.palette];
      const [moved] = pal.splice(from, 1);
      pal.splice(to, 0, moved);
      return { ...s, palette: pal };
    });
  }, []);

  const handleFile = useCallback(async (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return;
    const img = await loadImage(file);
    imgRef.current = img;
    setImgVersion((v) => v + 1);
    setState((s) => ({ ...s, fileName: file.name }));
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!stage || !canvas || !img) return;
    const draw = () => {
      const rect = stage.getBoundingClientRect();
      const g = renderToCanvas(canvas, img, state, rect.width - STAGE_PAD, rect.height - STAGE_PAD);
      setDims({ cols: g.cols, rows: g.rows });
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(stage);
    return () => ro.disconnect();
  }, [state, imgVersion, iconTick]);

  const hasImage = imgVersion > 0;
  const { colorMode } = state;
  const showLevels = colorMode === 'gradient';

  return (
    <div className="app">
      <aside className="panel">
        <header className="panel-head">
          <div className="brand">WKS GRID <span>v2</span></div>
          <div className="brand-sub">image → grid</div>
        </header>

        <div className="field">
          <div className="field-label">Source</div>
          <Segmented
            value={sourceMode}
            options={[{ value: 'upload', label: 'Upload' }, { value: 'icon', label: 'Icon' }]}
            onChange={(v: 'upload' | 'icon') => setSourceMode(v)}
          />
        </div>
        {sourceMode === 'upload' ? (
          <Dropzone fileName={state.fileName} onFile={handleFile} compact={hasImage} />
        ) : (
          <IconSearch onAdd={setIconSource} active={[]} placeholder="Search an icon to use as source…" />
        )}

        <Slider label="Detail" value={state.gridCols} min={16} max={160} step={1} onChange={(v) => set('gridCols', v)} readout={`${state.gridCols} wide`} />

        {showLevels && (
          <Slider label="Levels" value={state.levels} min={2} max={8} step={1} onChange={(v) => set('levels', v)} readout={`${state.levels}`} />
        )}

        {/* Style */}
        <div className="field">
          <div className="field-label">Style</div>
          <Segmented value={state.style} options={STYLES} onChange={setStyle} />
        </div>

        {/* Color mode */}
        <div className="field">
          <div className="field-label">Color</div>
          <Segmented
            value={colorMode}
            options={COLOR_MODES.filter((m) => colorModesFor(state.style).includes(m.value))}
            onChange={(v: ColorMode) => set('colorMode', v)}
          />
        </div>

        {/* Symbol library */}
        {state.style === 'symbols' && (
          <>
            <div className="field">
              <div className="field-label">Shapes</div>
              <div className="sym-grid">
                {SYMBOLS.map((sy) => {
                  const on = state.symbols.includes(sy.kind);
                  return (
                    <button
                      key={sy.kind}
                      className={`sym-chip ${on ? 'on' : ''}`}
                      title={sy.label}
                      aria-label={`${sy.label} ${on ? '(active)' : ''}`}
                      onClick={() => toggleSymbol(sy.kind)}
                    >
                      <svg viewBox="0 0 30 30" dangerouslySetInnerHTML={{ __html: symbolSVG(sy.kind, 15, 15, 24, on ? '#15f2fe' : '#9a9a9a') }} />
                    </button>
                  );
                })}
              </div>
              <IconSearch onAdd={addIcon} active={state.symbols} placeholder="Search icons (Iconify)…" />
            </div>

            <div className="field">
              <div className="field-label">
                <span>{state.scatter ? 'Symbols · random' : 'Ramp · dark → light'}</span>
                <button className={`mini ${state.scatter ? 'on' : ''}`} onClick={() => set('scatter', !state.scatter)} title="Random symbol per cell">
                  scatter
                </button>
              </div>
              <div className="sym-order">
                {state.symbols.map((id, i) => (
                  <div
                    key={id}
                    className="sym-order-chip"
                    draggable
                    title={`${isIcon(id) ? iconRef(id) : id} · drag to reorder, click to remove`}
                    onDragStart={() => (symDragIdx.current = i)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => { if (symDragIdx.current !== null) moveSymbol(symDragIdx.current, i); symDragIdx.current = null; }}
                    onDragEnd={() => (symDragIdx.current = null)}
                    onClick={() => toggleSymbol(id)}
                  >
                    {isIcon(id) ? (
                      <img src={iconSvgUrl(id, '#cfcfcf')} alt="" />
                    ) : (
                      <svg viewBox="0 0 30 30" dangerouslySetInnerHTML={{ __html: symbolSVG(id, 15, 15, 24, '#cfcfcf') }} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Palette controls */}
        {colorMode === 'palette' && (
          <>
            <div className="field">
              <div className="field-label">Match</div>
              <Segmented value={state.paletteMatch} options={MATCHES} onChange={(v) => set('paletteMatch', v)} />
            </div>
            <div className="field">
              <div className="field-label">Dither</div>
              <Segmented value={state.dither} options={DITHERS} onChange={(v) => set('dither', v)} />
            </div>
            <div className="field">
              <div className="field-label">Palette · {state.palette.length} colors</div>
              <div className="pal-toggles">
                {BRAND_SWATCHES.map((c) => {
                  const on = state.palette.some((h) => h.toLowerCase() === c.hex.toLowerCase());
                  return (
                    <button
                      key={c.hex}
                      className={`pal-chip ${on ? 'on' : ''}`}
                      style={{ background: c.hex }}
                      title={`${c.name} · ${c.hex}`}
                      aria-label={`${c.name} ${on ? '(in palette)' : ''}`}
                      onClick={() => togglePaletteColor(c.hex)}
                    />
                  );
                })}
              </div>
            </div>
            {state.paletteMatch === 'brightness' ? (
              <div className="field">
                <div className="field-label">Order · dark → light</div>
                <div className="pal-order">
                  {state.palette.map((hex, i) => (
                    <div
                      key={hex}
                      className="pal-order-chip"
                      draggable
                      style={{ background: hex }}
                      title={`${hex} · drag to reorder`}
                      onDragStart={() => (dragIdx.current = i)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (dragIdx.current !== null) movePalette(dragIdx.current, i);
                        dragIdx.current = null;
                      }}
                      onDragEnd={() => (dragIdx.current = null)}
                    >
                      <span className="pal-order-idx">{i + 1}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="field">
                <div className="hint">
                  Photo match assigns colors by hue, so order has no effect here. Switch Match to <b>Brightness</b> to control the dark → light order.
                </div>
              </div>
            )}
          </>
        )}

        {/* Colors */}
        <div className="field">
          <div className="field-label">Colors</div>
          <div className="swatches">
            {colorMode === 'mono' && <Swatch label="Ink" value={state.inkColor} onChange={(v) => set('inkColor', v)} />}
            {colorMode === 'gradient' && <Swatch label="Dark" value={state.colorDark} onChange={(v) => set('colorDark', v)} />}
            {colorMode === 'gradient' && <Swatch label="Light" value={state.colorLight} onChange={(v) => set('colorLight', v)} />}
            <Swatch label="Background" value={state.bgColor} onChange={(v) => set('bgColor', v)} />
          </div>
        </div>

        {/* Tone preview + invert */}
        <div className="field">
          <div className="field-label">
            <span>Tone preview · dark → light</span>
            <button className={`mini ${state.invert ? 'on' : ''}`} onClick={() => set('invert', !state.invert)} title="Swap dark / light mapping">
              invert
            </button>
          </div>
          <TonePreview state={state} tick={iconTick} />
        </div>

        {/* Tone */}
        <details className="tone">
          <summary>Adjust tone</summary>
          <Slider label="Exposure" value={state.exposure} min={-2} max={2} step={0.05} onChange={(v) => set('exposure', v)} readout={state.exposure.toFixed(2)} />
          <Slider label="Black" value={state.black} min={0} max={1} step={0.01} onChange={(v) => set('black', v)} readout={state.black.toFixed(2)} />
          <Slider label="White" value={state.white} min={0} max={1} step={0.01} onChange={(v) => set('white', v)} readout={state.white.toFixed(2)} />
          <Slider label="Gamma" value={state.gamma} min={0.2} max={5} step={0.05} onChange={(v) => set('gamma', v)} readout={state.gamma.toFixed(2)} />
        </details>

        {/* Presets */}
        <div className="field">
          <div className="field-label">Presets</div>
          <div className="preset-row">
            <input
              type="text"
              value={presetName}
              placeholder="Save current look as…"
              onChange={(e) => setPresetName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSavePreset(); }}
            />
            <button onClick={handleSavePreset} disabled={!presetName.trim()}>Save</button>
          </div>
          {presetNames.length > 0 && (
            <div className="preset-list">
              {presetNames.map((name) => (
                <div key={name} className="preset-item">
                  <button className="preset-load" onClick={() => handleLoadPreset(name)} title={`Load "${name}"`}>{name}</button>
                  <button className="preset-del" onClick={() => handleDeletePreset(name)} aria-label={`Delete ${name}`} title="Delete">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="export">
          <button disabled={!hasImage} onClick={() => imgRef.current && exportSVG(imgRef.current, state)}>Export SVG</button>
          <button disabled={!hasImage} onClick={() => imgRef.current && exportPNG(imgRef.current, state)}>Export PNG</button>
        </div>
      </aside>

      <main
        className={`stage ${dragging ? 'drag' : ''}`}
        ref={stageRef}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files?.[0]); }}
      >
        {hasImage ? (
          <>
            <canvas ref={canvasRef} className="art" />
            {dims && <div className="badge">{dims.cols} × {dims.rows} · {state.style} · {colorMode}{colorMode === 'palette' ? ` · ${state.dither}` : ''}</div>}
          </>
        ) : (
          <label className="empty">
            <input type="file" accept="image/*" hidden onChange={(e) => handleFile(e.target.files?.[0])} />
            <div className="empty-inner">
              <div className="empty-mark">＋</div>
              <div>Drop an image here</div>
              <div className="empty-sub">or click to choose</div>
            </div>
          </label>
        )}
      </main>
    </div>
  );
}

// ── Small components ──────────────────────────────────────

function Dropzone({ fileName, onFile, compact }: { fileName: string | null; onFile: (f: File | undefined) => void; compact: boolean }) {
  return (
    <label className={`drop ${compact ? 'compact' : ''}`}>
      <input type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      <span className="drop-icon">▣</span>
      <span className="drop-text">{fileName ?? 'Upload image'}</span>
      <span className="drop-action">{fileName ? 'replace' : ''}</span>
    </label>
  );
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string; hint?: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.value} className={value === o.value ? 'on' : ''} title={o.hint} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Slider(props: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; readout: string }) {
  return (
    <div className="field">
      <div className="field-label">
        <span>{props.label}</span>
        <span className="readout">{props.readout}</span>
      </div>
      <input type="range" min={props.min} max={props.max} step={props.step} value={props.value} onChange={(e) => props.onChange(parseFloat(e.target.value))} />
    </div>
  );
}

function Swatch({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="swatch-field">
      <label className="swatch">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
        <span>{label}</span>
      </label>
      <div className="brand-dots">
        {BRAND_SWATCHES.map((c) => (
          <button
            key={c.hex}
            className={`brand-dot ${value.toLowerCase() === c.hex.toLowerCase() ? 'on' : ''}`}
            style={{ background: c.hex }}
            title={`${c.name} · ${c.hex}`}
            aria-label={`${label}: ${c.name}`}
            onClick={() => onChange(c.hex)}
          />
        ))}
      </div>
    </div>
  );
}

function TonePreview({ state, tick }: { state: V2State; tick: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) renderPreview(ref.current, state);
  }, [state, tick]);
  return <canvas ref={ref} className="tone-preview" />;
}

function IconSearch({ onAdd, active, placeholder = 'Search icons (Iconify)…' }: { onAdd: (id: string) => void; active: string[]; placeholder?: string }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);

  const run = useCallback(async () => {
    const query = q.trim();
    if (!query) return;
    setBusy(true);
    setSearched(true);
    try {
      setResults(await searchIcons(query, 36));
    } finally {
      setBusy(false);
    }
  }, [q]);

  return (
    <div className="icon-search">
      <div className="icon-search-row">
        <input
          type="text"
          value={q}
          placeholder={placeholder}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') run(); }}
        />
        <button onClick={run} disabled={busy}>{busy ? '…' : 'Search'}</button>
      </div>
      {results.length > 0 && (
        <div className="icon-results">
          {results.map((id) => (
            <button
              key={id}
              className={`icon-result ${active.includes(id) ? 'on' : ''}`}
              title={iconRef(id)}
              onClick={() => onAdd(id)}
            >
              <img src={iconSvgUrl(id, '#cfcfcf')} alt={iconRef(id)} loading="lazy" />
            </button>
          ))}
        </div>
      )}
      {searched && !busy && results.length === 0 && <div className="hint">No icons found.</div>}
    </div>
  );
}

import { useState, useCallback } from 'react';
import type { AppState, LayerState, ChannelSource, PaintSymmetry, PaintTool } from '../state';
import { BLEND_MODES, createDefaultLayer, IMAGE_ASPECT_RATIOS, PAINT_GRID_PRESETS } from '../state';
import type { AppAction } from '../lib/actions';
import type { MaskType } from '../masks';
import type { SymbolType } from '../symbols';
import type { PaletteEntry } from '../gradient';
import { ALL_SYMBOLS, SYMBOL_LABELS, drawSymbolPreview } from '../symbols';
import { listPresetNames, savePreset, loadPreset, deletePreset } from '../presets';
import { loadImage, invalidateImageCache } from '../image';

import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Toggle } from '@/components/ui/toggle';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  RiEyeLine,
  RiEyeOffLine,
  RiArrowUpSLine,
  RiArrowDownSLine,
  RiDeleteBinLine,
  RiPlayFill,
  RiPauseFill,
  RiAddLine,
  RiLoopLeftLine,
  RiVideoLine,
  RiPencilLine,
  RiEraserLine,
  RiShuffleLine,
} from '@remixicon/react';

import { SliderField } from './SliderField';
import { ColorPickerField } from './ColorPickerField';
import { ChannelSelector } from './ChannelSelector';
import { SymbolGrid } from './SymbolGrid';
import { PaletteEditor } from './PaletteEditor';
import { ImageDropZone } from './ImageDropZone';

interface PanelProps {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  onExportPNG: () => void;
  onExportSVG: () => void;
  onExportVideo: () => void;
  videoExporting: boolean;
  videoProgress: number;
}

/* ── Shared sub-components ─────────────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-semibold text-foreground/40 uppercase tracking-[2px]">
      {children}
    </h3>
  );
}

/** A subtle card container that groups related controls */
function ControlCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-md border border-border bg-white/[0.02] p-3 space-y-3 ${className}`}>
      {children}
    </div>
  );
}

/** An inline label → value row for small metadata */
function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

/* ── Layer controls (inner accordion content) ──────────────── */

function LayerControls({
  layer,
  state,
  dispatch,
}: {
  layer: LayerState;
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}) {
  const hasImage = !!state.imageElement;
  const isImageMask = state.mask === 'image';
  const id = layer.id;

  const update = (updates: Partial<LayerState>) =>
    dispatch({ type: 'UPDATE_LAYER', layerId: id, updates });

  return (
    <div className="space-y-4 pt-3">
      {/* Brightness Range (image mask only) */}
      {isImageMask && (
        <ControlCard>
          <SectionLabel>Brightness Range</SectionLabel>
          <SliderField label="Min" min={0} max={1} step={0.01} value={layer.brightnessMin}
            format={v => v.toFixed(2)} onChange={v => update({ brightnessMin: v })} />
          <SliderField label="Max" min={0} max={1} step={0.01} value={layer.brightnessMax}
            format={v => v.toFixed(2)} onChange={v => update({ brightnessMax: v })} />
          <div className="h-2.5 rounded-sm" style={{
            background: `linear-gradient(to right, #000 0%, #000 ${layer.brightnessMin * 100}%, #fff ${layer.brightnessMin * 100}%, #fff ${layer.brightnessMax * 100}%, #000 ${layer.brightnessMax * 100}%, #000 100%)`,
          }} />
        </ControlCard>
      )}

      {/* Resolution */}
      <ControlCard>
        <SectionLabel>Resolution</SectionLabel>
        <SliderField label="Res" min={1} max={4} step={1} value={layer.resolution}
          format={v => `${v}×`}
          onChange={v => update({ resolution: v, toggledCells: new Set<string>() })} />
      </ControlCard>

      {/* Noise */}
      <ControlCard>
        <SectionLabel>Noise</SectionLabel>
        <SliderField label="Scale" min={1} max={100} step={1} value={layer.noiseScale}
          format={v => String(v)} onChange={v => update({ noiseScale: v })} />
        <SliderField label="Speed" min={0} max={200} step={1} value={layer.noiseSpeed}
          format={v => String(v)} onChange={v => update({ noiseSpeed: v })} />
        <SliderField label="Oct" min={1} max={4} step={1} value={layer.noiseOctaves}
          format={v => String(v)} onChange={v => update({ noiseOctaves: v })} />
      </ControlCard>

      {/* Channels */}
      <ControlCard>
        <SectionLabel>Channels</SectionLabel>
        <ChannelSelector label="Symbol" driven={layer.symbolDriven} source={layer.symbolSource}
          hasImage={hasImage} isImageMask={isImageMask}
          onSelect={(driven, source) => update({ symbolDriven: driven, symbolSource: source })} />
        <ChannelSelector label="Color" driven={layer.colorDriven} source={layer.colorSource}
          hasImage={hasImage} isImageMask={isImageMask}
          onSelect={(driven, source) => update({ colorDriven: driven, colorSource: source })} />
        <ChannelSelector label="Scale" driven={layer.scaleDriven} source={layer.scaleSource}
          hasImage={hasImage} isImageMask={isImageMask}
          onSelect={(driven, source) => update({ scaleDriven: driven, scaleSource: source })} />
        <SliderField label="Sc Min" min={0} max={1} step={0.01} value={layer.scaleMin}
          format={v => v.toFixed(2)} onChange={v => update({ scaleMin: v })} />
        <SliderField label="Sc Max" min={0} max={1} step={0.01} value={layer.scaleMax}
          format={v => v.toFixed(2)} onChange={v => update({ scaleMax: v })} />
        <ChannelSelector label="Fill" driven={layer.fillDriven} source={layer.fillSource}
          hasImage={hasImage} isImageMask={isImageMask}
          onSelect={(driven, source) => update({ fillDriven: driven, fillSource: source })} />
        <SliderField label="Cutoff" min={0} max={1} step={0.01} value={layer.fillCutoff}
          format={v => v.toFixed(2)} onChange={v => update({ fillCutoff: v })} />
      </ControlCard>

      {/* Symbols */}
      <ControlCard>
        <SectionLabel>Symbols</SectionLabel>
        <SymbolGrid
          activeSymbols={layer.activeSymbols}
          onChange={symbols => dispatch({ type: 'SET_LAYER_SYMBOLS', layerId: id, symbols })}
        />
      </ControlCard>

      {/* Colors */}
      <ControlCard>
        <SectionLabel>Colors</SectionLabel>
        <PaletteEditor
          palette={layer.colorPalette}
          onChange={palette => dispatch({ type: 'SET_LAYER_PALETTE', layerId: id, palette })}
        />
      </ControlCard>

      {/* Stroke */}
      <ControlCard>
        <SectionLabel>Stroke</SectionLabel>
        <SliderField label="Weight" min={0.5} max={5} step={0.5} value={layer.strokeWeight}
          format={v => v.toFixed(1)} onChange={v => update({ strokeWeight: v })} />
      </ControlCard>

      {/* Outline */}
      <ControlCard>
        <SectionLabel>Outline</SectionLabel>
        <MetaRow label="Enabled">
          <Switch checked={layer.outlineEnabled}
            onCheckedChange={v => update({ outlineEnabled: v })} />
        </MetaRow>
        {layer.outlineEnabled && (
          <div className="space-y-2 pt-1">
            <ColorPickerField label="Color" value={layer.outlineColor}
              onChange={v => update({ outlineColor: v })} />
            <SliderField label="Width" min={0.5} max={10} step={0.5} value={layer.outlineWidth}
              format={v => v.toFixed(1)} onChange={v => update({ outlineWidth: v })} />
            <SliderField label="Smooth" min={0} max={1} step={0.01} value={layer.outlineSmooth}
              format={v => v.toFixed(2)} onChange={v => update({ outlineSmooth: v })} />
          </div>
        )}
      </ControlCard>
    </div>
  );
}

/* ── Main Panel ────────────────────────────────────────────── */

export function Panel({ state, dispatch, onExportPNG, onExportSVG, onExportVideo, videoExporting, videoProgress }: PanelProps) {
  const [expandedLayers, setExpandedLayers] = useState<string[]>(
    state.layers.map(l => l.id)
  );
  const [presetName, setPresetName] = useState('');
  const [imageLayerCount, setImageLayerCount] = useState('4');

  const maskLabels: Record<string, MaskType> = {
    'Canvas': 'full', 'Icon': 'icon', 'Paint': 'paint', 'Image': 'image',
  };

  const currentMaskLabel = Object.entries(maskLabels).find(([, v]) => v === state.mask)?.[0]
    ?? (state.mask === 'lockup' ? 'Canvas' : 'Canvas');

  return (
    <div className="w-80 min-w-80 bg-sidebar border-r border-sidebar-border overflow-y-auto p-5 flex flex-col gap-5 panel-scroll">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-baseline justify-between">
        <h1 className="text-sm font-bold text-foreground tracking-wider uppercase">
          WKS Grid Engine
        </h1>
        <span className="text-[10px] text-muted-foreground">v6</span>
      </div>

      <div className="h-px bg-border" />

      {/* ── Mask ───────────────────────────────────────────── */}
      <div className="space-y-3">
        <SectionLabel>Mask</SectionLabel>
        <ToggleGroup
          value={[currentMaskLabel]}
          onValueChange={(values) => {
            const v = values[values.length - 1];
            if (v && maskLabels[v]) {
              dispatch({ type: 'SET_MASK', mask: maskLabels[v] });
            }
          }}
          className="justify-start gap-1"
        >
          {Object.keys(maskLabels).map(label => (
            <ToggleGroupItem key={label} value={label} size="sm" className="text-[11px] px-3 h-8">
              {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        {/* Paint controls */}
        {state.mask === 'paint' && (
          <ControlCard>
            {/* Grid Size */}
            <div className="space-y-2">
              <div className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">Grid Size</div>
              <div className="flex items-center gap-1.5">
                <Select
                  value={`${state.paintGridWidth}x${state.paintGridHeight}`}
                  onValueChange={(v) => {
                    if (v === 'custom') return;
                    const preset = PAINT_GRID_PRESETS.find(p => `${p.w}x${p.h}` === v);
                    if (preset) dispatch({ type: 'SET_PAINT_GRID_SIZE', width: preset.w, height: preset.h });
                  }}
                >
                  <SelectTrigger className="h-7 text-[11px] flex-1">
                    <SelectValue>
                      {PAINT_GRID_PRESETS.find(p => p.w === state.paintGridWidth && p.h === state.paintGridHeight)?.label
                        ?? `${state.paintGridWidth} × ${state.paintGridHeight}`}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {PAINT_GRID_PRESETS.map(p => (
                      <SelectItem key={`${p.w}x${p.h}`} value={`${p.w}x${p.h}`} className="text-[11px]">{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Custom width/height */}
              <div className="flex items-center gap-2">
                <Label className="text-[10px] text-muted-foreground">W</Label>
                <input
                  type="number"
                  min={4} max={100}
                  value={state.paintGridWidth}
                  onChange={(e) => {
                    const w = Math.max(1, Math.min(100, parseInt(e.target.value) || 24));
                    dispatch({ type: 'SET_PAINT_GRID_SIZE', width: w, height: state.paintGridHeight });
                  }}
                  className="h-7 w-14 rounded border border-border bg-transparent text-[11px] text-center tabular-nums px-1"
                />
                <Label className="text-[10px] text-muted-foreground">H</Label>
                <input
                  type="number"
                  min={4} max={100}
                  value={state.paintGridHeight}
                  onChange={(e) => {
                    const h = Math.max(1, Math.min(100, parseInt(e.target.value) || 24));
                    dispatch({ type: 'SET_PAINT_GRID_SIZE', width: state.paintGridWidth, height: h });
                  }}
                  className="h-7 w-14 rounded border border-border bg-transparent text-[11px] text-center tabular-nums px-1"
                />
              </div>
            </div>

            {/* Symmetry */}
            <div className="space-y-2">
              <div className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">Symmetry</div>
              <ToggleGroup
                value={[state.paintSymmetry]}
                onValueChange={(values) => {
                  const v = values[values.length - 1] as PaintSymmetry;
                  if (v) dispatch({ type: 'SET_PAINT_SYMMETRY', symmetry: v });
                }}
                className="justify-start gap-1"
              >
                <ToggleGroupItem value="none" size="sm" className="text-[10px] px-2 h-7">None</ToggleGroupItem>
                <ToggleGroupItem value="mirror-x" size="sm" className="text-[10px] px-2 h-7">Mirror X</ToggleGroupItem>
                <ToggleGroupItem value="mirror-y" size="sm" className="text-[10px] px-2 h-7">Mirror Y</ToggleGroupItem>
                <ToggleGroupItem value="quad" size="sm" className="text-[10px] px-2 h-7">Quad</ToggleGroupItem>
              </ToggleGroup>
            </div>

            {/* Tool */}
            <div className="space-y-2">
              <div className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">Tool</div>
              <ToggleGroup
                value={[state.paintTool]}
                onValueChange={(values) => {
                  const v = values[values.length - 1] as PaintTool;
                  if (v) dispatch({ type: 'SET_PAINT_TOOL', tool: v });
                }}
                className="justify-start gap-1"
              >
                <ToggleGroupItem value="pen" size="sm" className="text-[10px] px-3 h-7">
                  <RiPencilLine className="h-3 w-3 mr-1" /> Pen
                </ToggleGroupItem>
                <ToggleGroupItem value="eraser" size="sm" className="text-[10px] px-3 h-7">
                  <RiEraserLine className="h-3 w-3 mr-1" /> Eraser
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {/* Brush Size */}
            <div className="space-y-2">
              <div className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">Brush Size</div>
              <SliderField label="Size" min={1} max={5} step={1} value={state.paintBrushSize}
                format={v => `${v}×${v}`}
                onChange={v => dispatch({ type: 'SET_PAINT_BRUSH_SIZE', size: v })} />
            </div>

            {/* Clear / Fill */}
            <div className="flex gap-2">
              <Button variant="outline" size="xs" className="flex-1" onClick={() => dispatch({ type: 'CLEAR_PAINT_GRID' })}>
                Clear
              </Button>
              <Button variant="outline" size="xs" className="flex-1" onClick={() => dispatch({ type: 'FILL_PAINT_GRID' })}>
                Fill All
              </Button>
            </div>

            <div className="text-[10px] text-muted-foreground/60 leading-relaxed">
              Draw on the canvas to paint your mask
            </div>
          </ControlCard>
        )}

        {/* Image controls */}
        {state.mask === 'image' && (
          <ControlCard>
            {/* Aspect Ratio */}
            <div className="space-y-2">
              <div className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">Aspect Ratio</div>
              <ToggleGroup
                value={[state.imageAspectRatio]}
                onValueChange={(values) => {
                  const v = values[values.length - 1];
                  if (v) {
                    dispatch({ type: 'SET_IMAGE_ASPECT_RATIO', ratio: v as any });
                    invalidateImageCache();
                  }
                }}
                className="justify-start gap-1"
              >
                {IMAGE_ASPECT_RATIOS.map(r => (
                  <ToggleGroupItem key={r.value} value={r.value} size="sm" className="text-[10px] px-2 h-7">
                    {r.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            {state.imageElement ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <img src={state.imageElement.src} className="h-14 w-14 object-cover rounded border border-border" />
                  <div className="flex flex-col gap-1.5 flex-1">
                    <ImageDropZone compact label="Swap image" onImageLoaded={async (file) => {
                      try {
                        const img = await loadImage(file);
                        dispatch({ type: 'SET_IMAGE', image: img });
                        invalidateImageCache();
                        // Don't regenerate layers — keep existing settings
                      } catch (err) {
                        console.error('Failed to load image:', err);
                      }
                    }} />
                    <Button variant="outline" size="xs" className="w-full" onClick={() => {
                      dispatch({ type: 'SET_IMAGE', image: null });
                      invalidateImageCache();
                    }}>
                      Clear
                    </Button>
                  </div>
                </div>

                <SliderField label="Grid" min={20} max={100} step={1} value={state.imageGridSize}
                  format={v => String(v)}
                  onChange={v => { dispatch({ type: 'SET_IMAGE_GRID_SIZE', size: v }); invalidateImageCache(); }} />

                <div className="space-y-2">
                  <div className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">Image Fit</div>
                  <SliderField label="Zoom" min={1} max={4} step={0.05} value={state.imageScale}
                    format={v => `${v.toFixed(2)}×`}
                    onChange={v => { dispatch({ type: 'SET_IMAGE_SCALE', scale: v }); invalidateImageCache(); }} />
                  <SliderField label="Pan X" min={-1} max={1} step={0.01} value={state.imagePanX}
                    format={v => v.toFixed(2)}
                    onChange={v => { dispatch({ type: 'SET_IMAGE_PAN_X', value: v }); invalidateImageCache(); }} />
                  <SliderField label="Pan Y" min={-1} max={1} step={0.01} value={state.imagePanY}
                    format={v => v.toFixed(2)}
                    onChange={v => { dispatch({ type: 'SET_IMAGE_PAN_Y', value: v }); invalidateImageCache(); }} />
                </div>

                <div className="space-y-2">
                  <div className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">Levels</div>
                  <SliderField label="Exp" min={-2} max={2} step={0.05} value={state.imageExposure}
                    format={v => v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1)}
                    onChange={v => dispatch({ type: 'SET_IMAGE_EXPOSURE', value: v })} />
                  <SliderField label="Black" min={0} max={1} step={0.01} value={state.imageLevelsBlack}
                    format={v => v.toFixed(2)}
                    onChange={v => dispatch({ type: 'SET_IMAGE_LEVELS_BLACK', value: v })} />
                  <SliderField label="White" min={0} max={1} step={0.01} value={state.imageLevelsWhite}
                    format={v => v.toFixed(2)}
                    onChange={v => dispatch({ type: 'SET_IMAGE_LEVELS_WHITE', value: v })} />
                  <SliderField label="Gamma" min={0.2} max={5} step={0.05} value={state.imageLevelsGamma}
                    format={v => v.toFixed(2)}
                    onChange={v => dispatch({ type: 'SET_IMAGE_LEVELS_GAMMA', value: v })} />
                </div>

                <div className="flex items-center gap-2">
                  <Label className="text-[11px] text-muted-foreground">Layers</Label>
                  <Select value={imageLayerCount} onValueChange={(v) => { if (v) setImageLayerCount(v); }}>
                    <SelectTrigger className="h-7 text-[11px] w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[2, 3, 4].map(n => (
                        <SelectItem key={n} value={String(n)} className="text-[11px]">{n} layers</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="xs" onClick={() => dispatch({ type: 'GENERATE_IMAGE_LAYERS', count: parseInt(imageLayerCount) })}>
                    Generate
                  </Button>
                </div>
              </div>
            ) : (
              <ImageDropZone onImageLoaded={async (file) => {
                try {
                  const img = await loadImage(file);
                  dispatch({ type: 'SET_IMAGE', image: img });
                  invalidateImageCache();
                  dispatch({ type: 'GENERATE_IMAGE_LAYERS', count: 4 });
                } catch (err) {
                  console.error('Failed to load image:', err);
                }
              }} />
            )}
          </ControlCard>
        )}
      </div>

      <div className="h-px bg-border" />

      {/* ── Display ─────────────────────────────────────────── */}
      <div className="space-y-3">
        <SectionLabel>Display</SectionLabel>
        <ControlCard>
          <MetaRow label="Show Grid">
            <Switch checked={state.showGrid}
              onCheckedChange={v => dispatch({ type: 'SET_SHOW_GRID', show: v })} />
          </MetaRow>
          <ColorPickerField label="Background" value={state.backgroundColor}
            onChange={v => dispatch({ type: 'SET_BACKGROUND', color: v })} />
        </ControlCard>
      </div>

      <div className="h-px bg-border" />

      {/* ── Presets ─────────────────────────────────────────── */}
      <div className="space-y-3">
        <SectionLabel>Presets</SectionLabel>
        <div className="flex items-center gap-1.5">
          <Select value={presetName} onValueChange={(v) => { if (v) setPresetName(v); }}>
            <SelectTrigger className="h-8 text-[11px] flex-1">
              <SelectValue placeholder="Select preset…" />
            </SelectTrigger>
            <SelectContent>
              {listPresetNames().map(name => (
                <SelectItem key={name} value={name} className="text-[11px]">{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="xs" onClick={() => {
            const name = prompt('Preset name:');
            if (name?.trim()) {
              savePreset(name.trim(), state);
              setPresetName(name.trim());
            }
          }}>Save</Button>
          <Button variant="outline" size="xs" onClick={() => {
            if (!presetName) return;
            const loaded = loadPreset(presetName);
            if (loaded) dispatch({ type: 'APPLY_STATE', state: loaded });
          }}>Load</Button>
          <Button variant="outline" size="xs" onClick={() => {
            if (!presetName) return;
            deletePreset(presetName);
            setPresetName('');
          }}>Del</Button>
        </div>
      </div>

      <div className="h-px bg-border" />

      {/* ── Layers ──────────────────────────────────────────── */}
      <div className="space-y-3">
        <SectionLabel>Layers</SectionLabel>

        {state.layers.length < 4 && state.mask !== 'image' && (
          <Button variant="outline" size="sm" className="w-full h-9 text-[11px] border-dashed"
            onClick={() => dispatch({ type: 'ADD_LAYER' })}>
            <RiAddLine className="h-3.5 w-3.5 mr-1.5" />
            Add Layer ({state.layers.length}/4)
          </Button>
        )}

        <Accordion value={expandedLayers} onValueChange={setExpandedLayers}>
          {[...state.layers].reverse().map((layer, _ri) => {
            const idx = state.layers.indexOf(layer);
            return (
              <AccordionItem key={layer.id} value={layer.id} className="border-border/50">
                {/* Layer header */}
                <div className="flex items-center gap-1.5 py-1.5">
                  <AccordionTrigger className="flex-1 py-0 text-[12px] font-semibold hover:no-underline [&[data-state=open]>svg]:rotate-180">
                    {layer.name}
                  </AccordionTrigger>

                  <Button variant="ghost" size="icon-xs" className="text-muted-foreground hover:text-foreground"
                    onClick={(e) => { e.stopPropagation(); dispatch({ type: 'UPDATE_LAYER', layerId: layer.id, updates: { visible: !layer.visible } }); }}>
                    {layer.visible
                      ? <RiEyeLine className="h-3.5 w-3.5" />
                      : <RiEyeOffLine className="h-3.5 w-3.5" />}
                  </Button>

                  <Button variant="ghost" size="icon-xs" className="text-muted-foreground hover:text-foreground"
                    disabled={idx >= state.layers.length - 1}
                    onClick={(e) => { e.stopPropagation(); dispatch({ type: 'REORDER_LAYER', fromIdx: idx, toIdx: idx + 1 }); }}>
                    <RiArrowUpSLine className="h-3.5 w-3.5" />
                  </Button>

                  <Button variant="ghost" size="icon-xs" className="text-muted-foreground hover:text-foreground"
                    disabled={idx <= 0}
                    onClick={(e) => { e.stopPropagation(); dispatch({ type: 'REORDER_LAYER', fromIdx: idx, toIdx: idx - 1 }); }}>
                    <RiArrowDownSLine className="h-3.5 w-3.5" />
                  </Button>

                  <Button variant="ghost" size="icon-xs" className="text-muted-foreground hover:text-foreground"
                    title="Randomize layer"
                    onClick={(e) => { e.stopPropagation(); dispatch({ type: 'RANDOMIZE_LAYER', layerId: layer.id }); }}>
                    <RiShuffleLine className="h-3.5 w-3.5" />
                  </Button>

                  {state.layers.length > 1 && state.mask !== 'image' && (
                    <Button variant="ghost" size="icon-xs" className="text-destructive/70 hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); dispatch({ type: 'REMOVE_LAYER', layerId: layer.id }); }}>
                      <RiDeleteBinLine className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

                {/* Blend mode + opacity */}
                <div className="flex items-center gap-2 pb-2">
                  <Select value={layer.blendMode}
                    onValueChange={(v) => { if (v) dispatch({ type: 'UPDATE_LAYER', layerId: layer.id, updates: { blendMode: v } }); }}>
                    <SelectTrigger className="h-7 text-[11px] w-28" onClick={e => e.stopPropagation()}>
                      <SelectValue placeholder="Normal">
                        {BLEND_MODES.find(m => m.value === layer.blendMode)?.label ?? 'Normal'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {BLEND_MODES.map(mode => (
                        <SelectItem key={mode.value} value={mode.value} className="text-[11px]">{mode.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Label className="text-[11px] text-muted-foreground">Opacity</Label>
                  <Slider
                    value={[layer.opacity]}
                    min={0} max={1} step={0.01}
                    onValueChange={(v) => dispatch({ type: 'UPDATE_LAYER', layerId: layer.id, updates: { opacity: Array.isArray(v) ? v[0] : v } })}
                    className="flex-1"
                    onClick={e => e.stopPropagation()}
                  />
                  <span className="text-[11px] text-muted-foreground w-8 text-right tabular-nums">{layer.opacity.toFixed(2)}</span>
                </div>

                <AccordionContent>
                  <LayerControls layer={layer} state={state} dispatch={dispatch} />
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>

      <div className="h-px bg-border" />

      {/* ── Animation ───────────────────────────────────────── */}
      <div className="space-y-3">
        <SectionLabel>Animation</SectionLabel>
        <Button
          variant={state.animating ? 'default' : 'outline'}
          size="sm"
          className="w-full h-9 text-[11px] font-semibold tracking-wider uppercase"
          onClick={() => dispatch({ type: 'SET_ANIMATING', animating: !state.animating })}
        >
          {state.animating
            ? <><RiPauseFill className="h-3.5 w-3.5 mr-1.5" /> Pause</>
            : <><RiPlayFill className="h-3.5 w-3.5 mr-1.5" /> Play</>}
        </Button>

        <ControlCard>
          <MetaRow label="Loop Mode">
            <Switch checked={state.loopEnabled}
              onCheckedChange={v => dispatch({ type: 'SET_LOOP_ENABLED', enabled: v })} />
          </MetaRow>
          {state.loopEnabled && (
            <div className="space-y-2 pt-1">
              <SliderField label="Duration" min={1} max={30} step={0.5} value={state.loopDuration}
                format={v => `${v}s`}
                onChange={v => dispatch({ type: 'SET_LOOP_DURATION', duration: v })} />
              <SliderField label="Radius" min={0.02} max={1} step={0.02} value={state.loopRadius}
                format={v => v.toFixed(2)}
                onChange={v => dispatch({ type: 'SET_LOOP_RADIUS', radius: v })} />
            </div>
          )}
        </ControlCard>
      </div>

      <div className="h-px bg-border" />

      {/* ── Export ───────────────────────────────────────────── */}
      <div className="space-y-3">
        <SectionLabel>Export</SectionLabel>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1 h-9 text-[11px] font-semibold tracking-wider uppercase" onClick={onExportPNG}>PNG</Button>
          <Button variant="outline" size="sm" className="flex-1 h-9 text-[11px] font-semibold tracking-wider uppercase" onClick={onExportSVG}>SVG</Button>
        </div>
        {state.loopEnabled && (
          <Button
            variant="outline"
            size="sm"
            className="w-full h-9 text-[11px] font-semibold tracking-wider uppercase"
            disabled={videoExporting}
            onClick={onExportVideo}
          >
            <RiVideoLine className="h-3.5 w-3.5 mr-1.5" />
            {videoExporting
              ? `Exporting… ${Math.round(videoProgress * 100)}%`
              : `WebM ${state.loopDuration}s`}
          </Button>
        )}
      </div>

      <div className="h-6" /> {/* bottom breathing room */}
    </div>
  );
}

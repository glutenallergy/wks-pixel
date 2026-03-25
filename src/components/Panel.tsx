import { useState, useCallback } from 'react';
import type { AppState, LayerState, ChannelSource } from '../state';
import { BLEND_MODES, createDefaultLayer, IMAGE_ASPECT_RATIOS } from '../state';
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
import { Separator } from '@/components/ui/separator';
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

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-[1.5px] mb-2 mt-4 first:mt-0">
      {children}
    </h3>
  );
}

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
    <div className="space-y-3 pt-2">
      {/* Brightness Range (image mask only) */}
      {isImageMask && (
        <div>
          <SectionHeader>Brightness Range</SectionHeader>
          <SliderField label="Min" min={0} max={1} step={0.01} value={layer.brightnessMin}
            format={v => v.toFixed(2)} onChange={v => update({ brightnessMin: v })} />
          <SliderField label="Max" min={0} max={1} step={0.01} value={layer.brightnessMax}
            format={v => v.toFixed(2)} onChange={v => update({ brightnessMax: v })} />
          <div className="h-3 rounded-sm" style={{
            background: `linear-gradient(to right, #000 0%, #000 ${layer.brightnessMin * 100}%, #fff ${layer.brightnessMin * 100}%, #fff ${layer.brightnessMax * 100}%, #000 ${layer.brightnessMax * 100}%, #000 100%)`,
          }} />
        </div>
      )}

      {/* Resolution */}
      <div>
        <SectionHeader>Resolution</SectionHeader>
        <SliderField label="Resolution" min={1} max={4} step={1} value={layer.resolution}
          format={v => `${v}x`}
          onChange={v => update({ resolution: v, toggledCells: new Set<string>() })} />
      </div>

      {/* Noise */}
      <div>
        <SectionHeader>Noise</SectionHeader>
        <SliderField label="Scale" min={1} max={100} step={1} value={layer.noiseScale}
          format={v => String(v)} onChange={v => update({ noiseScale: v })} />
        <SliderField label="Speed" min={0} max={200} step={1} value={layer.noiseSpeed}
          format={v => String(v)} onChange={v => update({ noiseSpeed: v })} />
        <SliderField label="Octaves" min={1} max={4} step={1} value={layer.noiseOctaves}
          format={v => String(v)} onChange={v => update({ noiseOctaves: v })} />
      </div>

      {/* Channels */}
      <div>
        <SectionHeader>Channels</SectionHeader>
        <ChannelSelector label="Symbol" driven={layer.symbolDriven} source={layer.symbolSource}
          hasImage={hasImage} isImageMask={isImageMask}
          onSelect={(driven, source) => update({ symbolDriven: driven, symbolSource: source })} />
        <ChannelSelector label="Color" driven={layer.colorDriven} source={layer.colorSource}
          hasImage={hasImage} isImageMask={isImageMask}
          onSelect={(driven, source) => update({ colorDriven: driven, colorSource: source })} />
        <ChannelSelector label="Scale" driven={layer.scaleDriven} source={layer.scaleSource}
          hasImage={hasImage} isImageMask={isImageMask}
          onSelect={(driven, source) => update({ scaleDriven: driven, scaleSource: source })} />
        <SliderField label="Scale Min" min={0} max={1} step={0.01} value={layer.scaleMin}
          format={v => v.toFixed(2)} onChange={v => update({ scaleMin: v })} />
        <SliderField label="Scale Max" min={0} max={1} step={0.01} value={layer.scaleMax}
          format={v => v.toFixed(2)} onChange={v => update({ scaleMax: v })} />
        <ChannelSelector label="Fill" driven={layer.fillDriven} source={layer.fillSource}
          hasImage={hasImage} isImageMask={isImageMask}
          onSelect={(driven, source) => update({ fillDriven: driven, fillSource: source })} />
        <SliderField label="Fill Cutoff" min={0} max={1} step={0.01} value={layer.fillCutoff}
          format={v => v.toFixed(2)} onChange={v => update({ fillCutoff: v })} />
      </div>

      {/* Symbols */}
      <div>
        <SectionHeader>Symbols</SectionHeader>
        <SymbolGrid
          activeSymbols={layer.activeSymbols}
          onChange={symbols => dispatch({ type: 'SET_LAYER_SYMBOLS', layerId: id, symbols })}
        />
      </div>

      {/* Colors */}
      <div>
        <SectionHeader>Colors</SectionHeader>
        <PaletteEditor
          palette={layer.colorPalette}
          onChange={palette => dispatch({ type: 'SET_LAYER_PALETTE', layerId: id, palette })}
        />
      </div>

      {/* Stroke */}
      <div>
        <SectionHeader>Stroke</SectionHeader>
        <SliderField label="Weight" min={0.5} max={5} step={0.5} value={layer.strokeWeight}
          format={v => v.toFixed(1)} onChange={v => update({ strokeWeight: v })} />
      </div>

      {/* Outline */}
      <div>
        <SectionHeader>Outline</SectionHeader>
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">Enabled</Label>
          <Switch checked={layer.outlineEnabled}
            onCheckedChange={v => update({ outlineEnabled: v })} />
        </div>
        {layer.outlineEnabled && (
          <div className="mt-2 space-y-1">
            <ColorPickerField label="Color" value={layer.outlineColor}
              onChange={v => update({ outlineColor: v })} />
            <SliderField label="Width" min={0.5} max={10} step={0.5} value={layer.outlineWidth}
              format={v => v.toFixed(1)} onChange={v => update({ outlineWidth: v })} />
            <SliderField label="Smooth" min={0} max={1} step={0.01} value={layer.outlineSmooth}
              format={v => v.toFixed(2)} onChange={v => update({ outlineSmooth: v })} />
          </div>
        )}
      </div>
    </div>
  );
}

export function Panel({ state, dispatch, onExportPNG, onExportSVG, onExportVideo, videoExporting, videoProgress }: PanelProps) {
  const [expandedLayers, setExpandedLayers] = useState<string[]>(
    state.layers.map(l => l.id)
  );
  const [presetName, setPresetName] = useState('');
  const [imageLayerCount, setImageLayerCount] = useState('4');

  const maskLabels: Record<string, MaskType> = {
    'Canvas': 'full', 'Icon': 'icon', 'Image': 'image',
  };

  const currentMaskLabel = Object.entries(maskLabels).find(([, v]) => v === state.mask)?.[0]
    // Fallback: legacy 'lockup' maps to 'Canvas' in the UI
    ?? (state.mask === 'lockup' ? 'Canvas' : 'Canvas');

  return (
    <div className="w-80 min-w-80 bg-sidebar border-r border-border overflow-y-auto p-3 text-xs flex flex-col gap-1 scrollbar-thin">
      {/* Header */}
      <h1 className="text-sm font-bold text-foreground tracking-wide mb-2 font-mono">
        WKS Grid Engine
      </h1>

      <Separator />

      {/* Mask */}
      <SectionHeader>Mask</SectionHeader>
      <ToggleGroup
        value={[currentMaskLabel]}
        onValueChange={(values) => {
          const v = values[values.length - 1];
          if (v && maskLabels[v]) {
            dispatch({ type: 'SET_MASK', mask: maskLabels[v] });
          }
        }}
        className="justify-start"
      >
        {Object.keys(maskLabels).map(label => (
          <ToggleGroupItem key={label} value={label} size="sm" className="text-[10px] px-2 h-7">
            {label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {/* Image controls */}
      {state.mask === 'image' && (
        <div className="mt-2 space-y-2">
          {/* Aspect Ratio — always visible */}
          <div>
            <div className="text-[9px] font-semibold tracking-widest text-muted-foreground uppercase mb-1">Aspect Ratio</div>
            <ToggleGroup
              value={[state.imageAspectRatio]}
              onValueChange={(values) => {
                const v = values[values.length - 1];
                if (v) {
                  dispatch({ type: 'SET_IMAGE_ASPECT_RATIO', ratio: v as any });
                  invalidateImageCache();
                }
              }}
              className="justify-start"
            >
              {IMAGE_ASPECT_RATIOS.map(r => (
                <ToggleGroupItem key={r.value} value={r.value} size="sm" className="text-[10px] px-2 h-6">
                  {r.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          {state.imageElement ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <img src={state.imageElement.src} className="h-12 w-12 object-cover rounded-sm border border-border" />
                <Button variant="outline" size="sm" className="text-[10px] h-6"
                  onClick={() => {
                    dispatch({ type: 'SET_IMAGE', image: null });
                    invalidateImageCache();
                  }}>
                  Clear
                </Button>
              </div>

              <SliderField label="Grid Size" min={20} max={100} step={1} value={state.imageGridSize}
                format={v => String(v)}
                onChange={v => { dispatch({ type: 'SET_IMAGE_GRID_SIZE', size: v }); invalidateImageCache(); }} />

              {/* Image Fit / Pan */}
              <div className="mt-1">
                <div className="text-[9px] font-semibold tracking-widest text-muted-foreground uppercase mb-1">Image Fit</div>
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

              {/* Levels & Exposure */}
              <div className="mt-1">
                <div className="text-[9px] font-semibold tracking-widest text-muted-foreground uppercase mb-1">Levels & Exposure</div>
                <SliderField label="Exposure" min={-2} max={2} step={0.05} value={state.imageExposure}
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
                <Label className="text-[10px] text-muted-foreground">Layers</Label>
                <Select value={imageLayerCount} onValueChange={(v) => { if (v) setImageLayerCount(v); }}>
                  <SelectTrigger className="h-6 text-[10px] w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2, 3, 4].map(n => (
                      <SelectItem key={n} value={String(n)} className="text-xs">{n} layers</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" className="text-[10px] h-6"
                  onClick={() => dispatch({ type: 'GENERATE_IMAGE_LAYERS', count: parseInt(imageLayerCount) })}>
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
        </div>
      )}

      <Separator className="my-2" />

      {/* Grid */}
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">Show Grid</Label>
        <Switch checked={state.showGrid}
          onCheckedChange={v => dispatch({ type: 'SET_SHOW_GRID', show: v })} />
      </div>

      {/* Background */}
      <ColorPickerField label="Background" value={state.backgroundColor}
        onChange={v => dispatch({ type: 'SET_BACKGROUND', color: v })} />

      <Separator className="my-2" />

      {/* Presets */}
      <SectionHeader>Presets</SectionHeader>
      <div className="flex items-center gap-1">
        <Select value={presetName} onValueChange={(v) => { if (v) setPresetName(v); }}>
          <SelectTrigger className="h-7 text-[10px] flex-1">
            <SelectValue placeholder="-- Select --" />
          </SelectTrigger>
          <SelectContent>
            {listPresetNames().map(name => (
              <SelectItem key={name} value={name} className="text-xs">{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="text-[10px] h-7 px-2" onClick={() => {
          const name = prompt('Preset name:');
          if (name?.trim()) {
            savePreset(name.trim(), state);
            setPresetName(name.trim());
          }
        }}>Save</Button>
        <Button variant="outline" size="sm" className="text-[10px] h-7 px-2" onClick={() => {
          if (!presetName) return;
          const loaded = loadPreset(presetName);
          if (loaded) dispatch({ type: 'APPLY_STATE', state: loaded });
        }}>Load</Button>
        <Button variant="outline" size="sm" className="text-[10px] h-7 px-2" onClick={() => {
          if (!presetName) return;
          deletePreset(presetName);
          setPresetName('');
        }}>Del</Button>
      </div>

      <Separator className="my-2" />

      {/* Layers */}
      <SectionHeader>Layers</SectionHeader>
      {state.layers.length < 4 && state.mask !== 'image' && (
        <Button variant="outline" size="sm" className="w-full text-[10px] h-7 border-dashed mb-2"
          onClick={() => dispatch({ type: 'ADD_LAYER' })}>
          <RiAddLine className="h-3 w-3 mr-1" />
          Add Layer ({state.layers.length}/4)
        </Button>
      )}

      <Accordion value={expandedLayers} onValueChange={setExpandedLayers}>
        {[...state.layers].reverse().map((layer, _ri) => {
          const idx = state.layers.indexOf(layer);
          return (
            <AccordionItem key={layer.id} value={layer.id} className="border-border">
              {/* Custom header with controls outside the trigger */}
              <div className="flex items-center gap-1 py-1">
                <AccordionTrigger className="flex-1 py-0 text-xs font-medium hover:no-underline [&[data-state=open]>svg]:rotate-180">
                  {layer.name}
                </AccordionTrigger>

                <Button variant="ghost" size="icon" className="h-6 w-6"
                  onClick={(e) => { e.stopPropagation(); dispatch({ type: 'UPDATE_LAYER', layerId: layer.id, updates: { visible: !layer.visible } }); }}>
                  {layer.visible
                    ? <RiEyeLine className="h-3.5 w-3.5" />
                    : <RiEyeOffLine className="h-3.5 w-3.5 text-muted-foreground" />}
                </Button>

                <Button variant="ghost" size="icon" className="h-6 w-6"
                  disabled={idx >= state.layers.length - 1}
                  onClick={(e) => { e.stopPropagation(); dispatch({ type: 'REORDER_LAYER', fromIdx: idx, toIdx: idx + 1 }); }}>
                  <RiArrowUpSLine className="h-3.5 w-3.5" />
                </Button>

                <Button variant="ghost" size="icon" className="h-6 w-6"
                  disabled={idx <= 0}
                  onClick={(e) => { e.stopPropagation(); dispatch({ type: 'REORDER_LAYER', fromIdx: idx, toIdx: idx - 1 }); }}>
                  <RiArrowDownSLine className="h-3.5 w-3.5" />
                </Button>

                {state.layers.length > 1 && state.mask !== 'image' && (
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); dispatch({ type: 'REMOVE_LAYER', layerId: layer.id }); }}>
                    <RiDeleteBinLine className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              {/* Blend mode + opacity row */}
              <div className="flex items-center gap-2 pb-1">
                <Select value={layer.blendMode}
                  onValueChange={(v) => { if (v) dispatch({ type: 'UPDATE_LAYER', layerId: layer.id, updates: { blendMode: v } }); }}>
                  <SelectTrigger className="h-6 text-[10px] w-24" onClick={e => e.stopPropagation()}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BLEND_MODES.map(mode => (
                      <SelectItem key={mode.value} value={mode.value} className="text-xs">{mode.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Label className="text-[10px] text-muted-foreground">Op</Label>
                <Slider
                  value={[layer.opacity]}
                  min={0} max={1} step={0.01}
                  onValueChange={(v) => dispatch({ type: 'UPDATE_LAYER', layerId: layer.id, updates: { opacity: Array.isArray(v) ? v[0] : v } })}
                  className="flex-1"
                  onClick={e => e.stopPropagation()}
                />
                <span className="text-[10px] text-muted-foreground w-7 text-right">{layer.opacity.toFixed(2)}</span>
              </div>

              <AccordionContent>
                <LayerControls layer={layer} state={state} dispatch={dispatch} />
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      <Separator className="my-2" />

      {/* Animation */}
      <Button
        variant={state.animating ? 'default' : 'outline'}
        size="sm"
        className="w-full h-8 text-xs"
        onClick={() => dispatch({ type: 'SET_ANIMATING', animating: !state.animating })}
      >
        {state.animating
          ? <><RiPauseFill className="h-3.5 w-3.5 mr-1" /> PAUSE</>
          : <><RiPlayFill className="h-3.5 w-3.5 mr-1" /> PLAY</>}
      </Button>

      {/* Loop Mode */}
      <div className="mt-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <RiLoopLeftLine className="h-3 w-3" /> Loop Mode
          </Label>
          <Switch checked={state.loopEnabled}
            onCheckedChange={v => dispatch({ type: 'SET_LOOP_ENABLED', enabled: v })} />
        </div>
        {state.loopEnabled && (
          <div className="mt-2 space-y-1">
            <SliderField label="Duration" min={1} max={30} step={0.5} value={state.loopDuration}
              format={v => `${v}s`}
              onChange={v => dispatch({ type: 'SET_LOOP_DURATION', duration: v })} />
            <SliderField label="Radius" min={0.02} max={1} step={0.02} value={state.loopRadius}
              format={v => v.toFixed(2)}
              onChange={v => dispatch({ type: 'SET_LOOP_RADIUS', radius: v })} />
          </div>
        )}
      </div>

      <Separator className="my-2" />

      {/* Export */}
      <SectionHeader>Export</SectionHeader>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1 text-xs h-7" onClick={onExportPNG}>PNG</Button>
        <Button variant="outline" size="sm" className="flex-1 text-xs h-7" onClick={onExportSVG}>SVG</Button>
      </div>
      {state.loopEnabled && (
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs h-7 mt-1"
          disabled={videoExporting}
          onClick={onExportVideo}
        >
          <RiVideoLine className="h-3.5 w-3.5 mr-1" />
          {videoExporting
            ? `Exporting... ${Math.round(videoProgress * 100)}%`
            : `Export WebM (${state.loopDuration}s loop)`}
        </Button>
      )}

      <div className="h-4" /> {/* bottom padding */}
    </div>
  );
}

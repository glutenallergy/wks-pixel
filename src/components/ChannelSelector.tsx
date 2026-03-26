import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { ChannelSource } from '../state';

interface ChannelSelectorProps {
  label: string;
  driven: boolean;
  source: ChannelSource;
  hasImage: boolean;
  isImageMask: boolean;
  onSelect: (driven: boolean, source: ChannelSource) => void;
}

export function ChannelSelector({ label, driven, source, hasImage, isImageMask, onSelect }: ChannelSelectorProps) {
  const options = (!isImageMask && hasImage) ? ['Off', 'Noise', 'Image'] : ['Off', 'Noise'];

  let active: string;
  if (source === 'image' && !isImageMask && hasImage) {
    active = 'Image';
  } else if (driven) {
    active = 'Noise';
  } else {
    active = 'Off';
  }

  return (
    <div className="flex items-center gap-3 py-0.5">
      <Label className="text-[11px] text-muted-foreground w-14 shrink-0">{label}</Label>
      <ToggleGroup
        value={[active]}
        onValueChange={(values) => {
          const v = values[values.length - 1];
          if (!v) return;
          switch (v) {
            case 'Off': onSelect(false, 'noise'); break;
            case 'Noise': onSelect(true, 'noise'); break;
            case 'Image': onSelect(true, 'image'); break;
          }
        }}
        className="gap-1"
      >
        {options.map(opt => (
          <ToggleGroupItem key={opt} value={opt} size="sm" className="text-[10px] px-2.5 h-7">
            {opt}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

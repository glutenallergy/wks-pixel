import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';

interface SliderFieldProps {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}

export function SliderField({ label, min, max, step, value, format, onChange }: SliderFieldProps) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <Label className="text-[10px] text-muted-foreground w-16 shrink-0">{label}</Label>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(Array.isArray(v) ? v[0] : v)}
        className="flex-1"
      />
      <span className="text-[10px] text-muted-foreground w-8 text-right shrink-0">{format(value)}</span>
    </div>
  );
}

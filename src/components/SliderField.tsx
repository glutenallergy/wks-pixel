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
    <div className="flex items-center gap-3 py-0.5">
      <Label className="text-[11px] text-muted-foreground w-14 shrink-0 tabular-nums">{label}</Label>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(Array.isArray(v) ? v[0] : v)}
        className="flex-1"
      />
      <span className="text-[11px] text-foreground/60 w-10 text-right shrink-0 tabular-nums">{format(value)}</span>
    </div>
  );
}

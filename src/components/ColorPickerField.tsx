import { Label } from '@/components/ui/label';

interface ColorPickerFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
}

export function ColorPickerField({ label, value, onChange }: ColorPickerFieldProps) {
  return (
    <div className="flex items-center gap-3 py-0.5">
      <Label className="text-[11px] text-muted-foreground w-14 shrink-0">{label}</Label>
      <input
        type="color"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-7 w-9 rounded border border-border bg-transparent cursor-pointer p-0"
      />
      <span className="text-[11px] text-foreground/60 tabular-nums">{value}</span>
    </div>
  );
}

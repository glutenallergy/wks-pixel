import { Label } from '@/components/ui/label';

interface ColorPickerFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
}

export function ColorPickerField({ label, value, onChange }: ColorPickerFieldProps) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <Label className="text-[10px] text-muted-foreground w-16 shrink-0">{label}</Label>
      <input
        type="color"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-6 w-8 rounded-sm border border-border bg-transparent cursor-pointer p-0"
      />
      <span className="text-[10px] text-muted-foreground">{value}</span>
    </div>
  );
}

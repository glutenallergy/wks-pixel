import { useState, useRef } from 'react';

interface ImageDropZoneProps {
  onImageLoaded: (file: File) => void;
  /** Compact inline variant for swapping an existing image */
  compact?: boolean;
  label?: string;
}

export function ImageDropZone({ onImageLoaded, compact, label }: ImageDropZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <div
        className={`border-2 border-dashed rounded-md text-center text-[11px] text-muted-foreground cursor-pointer transition-colors ${
          dragOver ? 'border-primary/60 bg-primary/5' : 'border-border hover:border-foreground/20'
        } ${compact ? 'px-3 py-2' : 'p-5'}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer?.files[0]) onImageLoaded(e.dataTransfer.files[0]);
        }}
      >
        {label ?? 'Drop image or click to browse'}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) onImageLoaded(e.target.files[0]);
          // Reset so re-selecting the same file triggers onChange
          if (inputRef.current) inputRef.current.value = '';
        }}
      />
    </>
  );
}

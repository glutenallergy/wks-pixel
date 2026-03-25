import { useState, useRef } from 'react';

interface ImageDropZoneProps {
  onImageLoaded: (file: File) => void;
}

export function ImageDropZone({ onImageLoaded }: ImageDropZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <div
        className={`border-2 border-dashed rounded-md p-4 text-center text-[10px] text-muted-foreground cursor-pointer transition-colors ${
          dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground'
        }`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer?.files[0]) onImageLoaded(e.dataTransfer.files[0]);
        }}
      >
        Drop image here or click to browse
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) onImageLoaded(e.target.files[0]);
        }}
      />
    </>
  );
}

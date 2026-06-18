// ── Image loading + brightness sampling ──────────────────
// Lean, self-contained. Borrows the proven luminance + levels math
// from the original engine, trimmed to exactly what v2 needs.

export function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Sample image luminance into a cols×rows grid using cover-fit (centered).
 * Returns brightness in 0..1 (ITU-R BT.709), row-major.
 */
export function sampleBrightness(
  img: HTMLImageElement,
  cols: number,
  rows: number,
): Float32Array {
  const imgW = img.naturalWidth;
  const imgH = img.naturalHeight;
  const gridAspect = cols / rows;
  const imgAspect = imgW / imgH;

  // Cover-fit source rect (crop the overflowing axis)
  let srcW: number, srcH: number;
  if (imgAspect > gridAspect) {
    srcH = imgH;
    srcW = srcH * gridAspect;
  } else {
    srcW = imgW;
    srcH = srcW / gridAspect;
  }
  const sx = (imgW - srcW) / 2;
  const sy = (imgH - srcH) / 2;

  const canvas = document.createElement('canvas');
  canvas.width = cols;
  canvas.height = rows;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, sx, sy, srcW, srcH, 0, 0, cols, rows);

  const data = ctx.getImageData(0, 0, cols, rows).data;
  const out = new Float32Array(cols * rows);
  for (let i = 0; i < out.length; i++) {
    const o = i * 4;
    out[i] = (data[o] * 0.2126 + data[o + 1] * 0.7152 + data[o + 2] * 0.0722) / 255;
  }
  return out;
}

export interface Sampled {
  rgb: Float32Array; // length cols*rows*3, channels 0..1
  lum: Float32Array; // length cols*rows, 0..1
}

/** Sample image to a cols×rows grid (cover-fit), keeping both RGB and luminance. */
export function sampleImage(img: HTMLImageElement, cols: number, rows: number): Sampled {
  const imgW = img.naturalWidth;
  const imgH = img.naturalHeight;
  const gridAspect = cols / rows;
  const imgAspect = imgW / imgH;

  let srcW: number, srcH: number;
  if (imgAspect > gridAspect) {
    srcH = imgH;
    srcW = srcH * gridAspect;
  } else {
    srcW = imgW;
    srcH = srcW / gridAspect;
  }
  const sx = (imgW - srcW) / 2;
  const sy = (imgH - srcH) / 2;

  const canvas = document.createElement('canvas');
  canvas.width = cols;
  canvas.height = rows;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, sx, sy, srcW, srcH, 0, 0, cols, rows);

  const data = ctx.getImageData(0, 0, cols, rows).data;
  const n = cols * rows;
  const rgb = new Float32Array(n * 3);
  const lum = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const r = data[o] / 255;
    const g = data[o + 1] / 255;
    const b = data[o + 2] / 255;
    rgb[i * 3] = r;
    rgb[i * 3 + 1] = g;
    rgb[i * 3 + 2] = b;
    lum[i] = r * 0.2126 + g * 0.7152 + b * 0.0722;
  }
  return { rgb, lum };
}

export interface ToneParams {
  exposure: number;
  black: number;
  white: number;
  gamma: number;
}

function adjustValue(v: number, expMul: number, black: number, invRange: number, invGamma: number): number {
  let x = v * expMul;
  x = (x - black) * invRange;
  x = Math.max(0, Math.min(1, x));
  if (invGamma !== 1) x = Math.pow(x, invGamma);
  return x;
}

/** Apply tone (exposure/levels/gamma) to each RGB channel. Returns a new array (or the input if no-op). */
export function adjustRGB(rgb: Float32Array, t: ToneParams): Float32Array {
  if (t.exposure === 0 && t.black === 0 && t.white === 1 && t.gamma === 1) return rgb;
  const out = new Float32Array(rgb.length);
  const expMul = Math.pow(2, t.exposure);
  const range = t.white - t.black;
  const invRange = range > 0.001 ? 1 / range : 1000;
  const invGamma = 1 / t.gamma;
  for (let i = 0; i < rgb.length; i++) out[i] = adjustValue(rgb[i], expMul, t.black, invRange, invGamma);
  return out;
}

/** Apply exposure → levels (black/white points) → gamma. Pure, returns a new array. */
export function adjustBrightness(raw: Float32Array, t: ToneParams): Float32Array {
  if (t.exposure === 0 && t.black === 0 && t.white === 1 && t.gamma === 1) return raw;

  const out = new Float32Array(raw.length);
  const expMul = Math.pow(2, t.exposure);
  const range = t.white - t.black;
  const invRange = range > 0.001 ? 1 / range : 1000;
  const invGamma = 1 / t.gamma;

  for (let i = 0; i < raw.length; i++) {
    let v = raw[i] * expMul;
    v = (v - t.black) * invRange;
    v = Math.max(0, Math.min(1, v));
    if (invGamma !== 1) v = Math.pow(v, invGamma);
    out[i] = v;
  }
  return out;
}

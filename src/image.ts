// ── Image brightness extraction ──────────────

const brightnessCache = new Map<string, Float32Array>();
let cachedImageSrc: string | null = null;

export function invalidateImageCache(): void {
  brightnessCache.clear();
  cachedImageSrc = null;
}

/**
 * Extract brightness from an image using cover-fit with optional pan/scale.
 *
 * @param img       Source image element
 * @param width     Grid width in cells
 * @param height    Grid height in cells
 * @param scale     1 = cover-fit (image fills grid with no gaps), >1 = zoom in further
 * @param panX      -1..1 horizontal pan within the overflowing axis
 * @param panY      -1..1 vertical pan within the overflowing axis
 */
export function getBrightness(
  img: HTMLImageElement,
  width: number,
  height: number,
  scale: number = 1,
  panX: number = 0,
  panY: number = 0,
): Float32Array {
  // Invalidate if image changed
  if (img.src !== cachedImageSrc) {
    brightnessCache.clear();
    cachedImageSrc = img.src;
  }

  const key = `${width}x${height}|s${scale}|px${panX}|py${panY}`;
  let cached = brightnessCache.get(key);
  if (cached) return cached;

  // Compute cover-fit source rect
  const imgW = img.naturalWidth;
  const imgH = img.naturalHeight;
  const gridAspect = width / height;
  const imgAspect = imgW / imgH;

  // Cover: scale image so it fully covers the grid area
  let srcW: number, srcH: number;
  if (imgAspect > gridAspect) {
    // Image is wider than grid — crop sides
    srcH = imgH / scale;
    srcW = srcH * gridAspect;
  } else {
    // Image is taller than grid — crop top/bottom
    srcW = imgW / scale;
    srcH = srcW / gridAspect;
  }

  // Clamp source dimensions to image bounds
  srcW = Math.min(srcW, imgW);
  srcH = Math.min(srcH, imgH);

  // Pan: map -1..1 to available overflow range
  const overflowX = imgW - srcW;
  const overflowY = imgH - srcH;
  const sx = ((panX + 1) / 2) * overflowX; // panX=-1 → left edge, +1 → right edge
  const sy = ((panY + 1) / 2) * overflowY; // panY=-1 → top edge, +1 → bottom edge

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, sx, sy, srcW, srcH, 0, 0, width, height);

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const result = new Float32Array(width * height);

  for (let i = 0; i < result.length; i++) {
    const offset = i * 4;
    // Luminance formula (ITU-R BT.709)
    result[i] = (data[offset] * 0.2126 + data[offset + 1] * 0.7152 + data[offset + 2] * 0.0722) / 255;
  }

  brightnessCache.set(key, result);
  return result;
}

// ── Brightness adjustment (levels & exposure) ──

let adjustedCache: Float32Array | null = null;
let adjustedCacheKey = '';
let adjustedCacheRaw: Float32Array | null = null;

export function adjustBrightness(
  raw: Float32Array,
  exposure: number,
  black: number,
  white: number,
  gamma: number,
): Float32Array {
  const key = `${raw.length}|${exposure}|${black}|${white}|${gamma}`;
  if (adjustedCache && adjustedCacheKey === key && adjustedCacheRaw === raw) return adjustedCache;

  // No adjustment needed — return raw
  if (exposure === 0 && black === 0 && white === 1 && gamma === 1) {
    adjustedCache = raw;
    adjustedCacheKey = key;
    adjustedCacheRaw = raw;
    return raw;
  }

  const result = new Float32Array(raw.length);
  const expMul = Math.pow(2, exposure);
  const range = white - black;
  const invRange = range > 0.001 ? 1 / range : 1000; // avoid division by zero
  const invGamma = 1 / gamma;

  for (let i = 0; i < raw.length; i++) {
    // 1. Exposure
    let v = raw[i] * expMul;
    // 2. Levels remap (black/white points)
    v = (v - black) * invRange;
    // 3. Clamp before gamma (avoid NaN from negative ^ fractional)
    v = Math.max(0, Math.min(1, v));
    // 4. Gamma / midtone curve
    if (invGamma !== 1) v = Math.pow(v, invGamma);
    result[i] = v;
  }

  adjustedCache = result;
  adjustedCacheKey = key;
  adjustedCacheRaw = raw;
  return result;
}

export function invalidateAdjustedCache(): void {
  adjustedCache = null;
  adjustedCacheKey = '';
  adjustedCacheRaw = null;
}

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

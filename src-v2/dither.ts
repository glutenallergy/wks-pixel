// ── Palette quantization + dithering ─────────────────────
// Reduces an image to a fixed palette of colors, optionally dithered.
// This is what produces the "AtX poster" look: flat color blocks,
// ordered (Bayer) texture, and Floyd–Steinberg photographic stipple.

export type Dither = 'none' | 'ordered' | 'diffusion';

// 4×4 Bayer threshold matrix, normalized to (0,1).
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
function bayer(col: number, row: number): number {
  return BAYER4[(row & 3) * 4 + (col & 3)];
}

export function hexToRgb(hex: string): [number, number, number] {
  let x = hex.replace('#', '');
  if (x.length === 3) x = x.split('').map((c) => c + c).join('');
  return [parseInt(x.slice(0, 2), 16), parseInt(x.slice(2, 4), 16), parseInt(x.slice(4, 6), 16)];
}

function nearestIndex(r: number, g: number, b: number, pal: [number, number, number][]): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < pal.length; i++) {
    const dr = r - pal[i][0];
    const dg = g - pal[i][1];
    const db = b - pal[i][2];
    const d = dr * dr + dg * dg + db * db;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

// Ordered-dither spread, in 0..255 units. Roughly half a palette step's worth
// of jitter so intermediate tones mix between the two nearest colors.
const ORDERED_SPREAD = 100;

/**
 * Quantize an RGB grid to palette indices, matching each cell to the nearest
 * palette color (with optional dithering). `rgb` is 0..1, length cols*rows*3.
 */
export function quantizeRGB(
  rgb: Float32Array,
  cols: number,
  rows: number,
  palHex: string[],
  dither: Dither,
): Int32Array {
  const pal = palHex.map(hexToRgb);
  const n = cols * rows;
  const out = new Int32Array(n);

  if (dither === 'diffusion') {
    // Floyd–Steinberg over a mutable copy (0..255).
    const buf = new Float32Array(n * 3);
    for (let i = 0; i < n * 3; i++) buf[i] = rgb[i] * 255;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const i = row * cols + col;
        const o = i * 3;
        const idx = nearestIndex(buf[o], buf[o + 1], buf[o + 2], pal);
        out[i] = idx;
        const er = buf[o] - pal[idx][0];
        const eg = buf[o + 1] - pal[idx][1];
        const eb = buf[o + 2] - pal[idx][2];
        const push = (c: number, r2: number, f: number) => {
          if (c < 0 || c >= cols || r2 < 0 || r2 >= rows) return;
          const p = (r2 * cols + c) * 3;
          buf[p] += er * f;
          buf[p + 1] += eg * f;
          buf[p + 2] += eb * f;
        };
        push(col + 1, row, 7 / 16);
        push(col - 1, row + 1, 3 / 16);
        push(col, row + 1, 5 / 16);
        push(col + 1, row + 1, 1 / 16);
      }
    }
    return out;
  }

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = row * cols + col;
      const o = i * 3;
      let r = rgb[o] * 255;
      let g = rgb[o + 1] * 255;
      let b = rgb[o + 2] * 255;
      if (dither === 'ordered') {
        const off = (bayer(col, row) - 0.5) * ORDERED_SPREAD;
        r += off;
        g += off;
        b += off;
      }
      out[i] = nearestIndex(r, g, b, pal);
    }
  }
  return out;
}

/**
 * Quantize by brightness: map each cell's tone (0=dark .. 1=light) onto the
 * palette IN ORDER — palette[0] = darkest band, palette[P-1] = lightest band —
 * with optional dithering. Reordering the palette changes which color lands on
 * darks vs lights, independent of the colors' own luminance.
 */
export function quantizeBrightness(
  tone: Float32Array,
  cols: number,
  rows: number,
  palHex: string[],
  dither: Dither,
): Int32Array {
  const P = palHex.length;
  const n = cols * rows;
  const out = new Int32Array(n);
  const denom = Math.max(1, P - 1); // band spacing

  if (dither === 'diffusion') {
    const buf = Float32Array.from(tone);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const i = row * cols + col;
        const k = Math.max(0, Math.min(P - 1, Math.round(buf[i] * denom)));
        out[i] = k; // band index == palette index (palette is the order)
        const err = buf[i] - k / denom;
        const push = (c: number, r2: number, f: number) => {
          if (c < 0 || c >= cols || r2 < 0 || r2 >= rows) return;
          buf[r2 * cols + c] += err * f;
        };
        push(col + 1, row, 7 / 16);
        push(col - 1, row + 1, 3 / 16);
        push(col, row + 1, 5 / 16);
        push(col + 1, row + 1, 1 / 16);
      }
    }
    return out;
  }

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = row * cols + col;
      let v = tone[i];
      if (dither === 'ordered') v += (bayer(col, row) - 0.5) / denom;
      out[i] = Math.max(0, Math.min(P - 1, Math.round(v * denom)));
    }
  }
  return out;
}

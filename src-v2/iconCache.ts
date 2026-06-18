// ── Iconify integration ──────────────────────────────────
// Search + import icons from the (free, no-key, CORS-friendly) Iconify API,
// restricted to permissively-licensed sets. Icons become symbols with ids
// like "icon:tabler:star" and flow through the normal render/export pipeline.

const ENDPOINT = 'https://api.iconify.design';
export const ICON_PREFIX = 'icon:';

// Permissive sets only (MIT / Apache / ISC) — safe for commercial brand work.
export const PERMISSIVE_PREFIXES = ['tabler', 'lucide', 'ph', 'material-symbols', 'carbon', 'mdi', 'bi', 'heroicons'];

export function isIcon(id: string): boolean {
  return id.startsWith(ICON_PREFIX);
}
export function iconRef(id: string): string {
  return id.slice(ICON_PREFIX.length); // "prefix:name"
}
export function iconSvgUrl(id: string, color?: string): string {
  const ref = iconRef(id);
  const ci = ref.indexOf(':');
  const prefix = ref.slice(0, ci);
  const name = ref.slice(ci + 1);
  return `${ENDPOINT}/${prefix}/${name}.svg${color ? `?color=${encodeURIComponent(color)}` : ''}`;
}

interface Entry {
  body: string;
  w: number;
  h: number;
  loaded: boolean;
}

const entries = new Map<string, Entry>();
const rasters = new Map<string, HTMLCanvasElement>(); // key: id + '|' + color
const RASTER_PX = 64;

let readyCb: (() => void) | null = null;
export function setOnIconReady(cb: () => void): void {
  readyCb = cb;
}
function notify(): void {
  if (readyCb) readyCb();
}

/** Fetch an icon's vector body once and cache it. */
export async function loadIcon(id: string): Promise<void> {
  if (entries.has(id)) return;
  entries.set(id, { body: '', w: 16, h: 16, loaded: false }); // reserve so we fetch once
  try {
    const ref = iconRef(id);
    const ci = ref.indexOf(':');
    const prefix = ref.slice(0, ci);
    const name = ref.slice(ci + 1);
    const res = await fetch(`${ENDPOINT}/${prefix}.json?icons=${encodeURIComponent(name)}`);
    const data = await res.json();
    const icon = data?.icons?.[name];
    if (icon && icon.body) {
      entries.set(id, {
        body: icon.body,
        w: icon.width ?? data.width ?? 16,
        h: icon.height ?? data.height ?? 16,
        loaded: true,
      });
      notify();
    }
  } catch {
    /* leave unloaded; render skips it */
  }
}

/**
 * Get a rasterized (icon, color) canvas for fast per-cell drawing. Returns a
 * blank-then-filled canvas: the first call kicks off async rasterization and
 * notify() triggers a re-render once it's painted.
 */
export function getRaster(id: string, color: string): HTMLCanvasElement | null {
  const e = entries.get(id);
  if (!e) {
    loadIcon(id);
    return null;
  }
  if (!e.loaded) return null;

  const key = id + '|' + color;
  const cached = rasters.get(key);
  if (cached) return cached;

  const cv = document.createElement('canvas');
  cv.width = RASTER_PX;
  cv.height = RASTER_PX;
  rasters.set(key, cv);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${e.w} ${e.h}" width="${RASTER_PX}" height="${RASTER_PX}" fill="${color}" color="${color}">${e.body}</svg>`;
  const img = new Image();
  img.onload = () => {
    const ctx = cv.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, RASTER_PX, RASTER_PX);
      ctx.drawImage(img, 0, 0, RASTER_PX, RASTER_PX);
    }
    notify();
  };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  return cv; // blank until onload fires
}

/**
 * Rasterize an icon as a large source image (dark icon on light ground) to use
 * as the canvas INPUT instead of an uploaded photo. Returns once loaded.
 */
export async function iconAsImage(
  id: string,
  px = 640,
  color = '#111111',
  bg = '#ffffff',
): Promise<HTMLImageElement | null> {
  await loadIcon(id);
  const e = entries.get(id);
  if (!e || !e.loaded) return null;
  const pad = px * 0.14;
  const inner = px - pad * 2;
  const scale = inner / Math.max(e.w, e.h);
  const dw = e.w * scale;
  const dh = e.h * scale;
  const tx = (px - dw) / 2;
  const ty = (px - dh) / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${px} ${px}"><rect width="${px}" height="${px}" fill="${bg}"/><g transform="translate(${tx},${ty}) scale(${scale})" fill="${color}" color="${color}">${e.body}</g></svg>`;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

/** Vector def for SVG export (null if not loaded yet). */
export function getIconDef(id: string): { body: string; w: number; h: number } | null {
  const e = entries.get(id);
  return e && e.loaded ? { body: e.body, w: e.w, h: e.h } : null;
}

/** Search Iconify within the permissive sets. Returns symbol ids ("icon:prefix:name"). */
export async function searchIcons(query: string, limit = 36): Promise<string[]> {
  const url = `${ENDPOINT}/search?query=${encodeURIComponent(query)}&limit=${limit}&prefixes=${PERMISSIVE_PREFIXES.join(',')}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    return (data?.icons ?? []).map((ref: string) => ICON_PREFIX + ref);
  } catch {
    return [];
  }
}

export interface GradientStop {
  position: number; // 0–1
  color: string;    // hex
}

export interface PaletteEntry {
  id: string;
  name: string;
  stops: GradientStop[];
  selected: boolean;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(c =>
    Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, '0')
  ).join('');
}

export function sampleGradient(stops: GradientStop[], t: number): string {
  if (stops.length === 0) return '#000000';
  if (stops.length === 1) return stops[0].color;

  t = Math.max(0, Math.min(1, t));

  const sorted = [...stops].sort((a, b) => a.position - b.position);

  if (t <= sorted[0].position) return sorted[0].color;
  if (t >= sorted[sorted.length - 1].position) return sorted[sorted.length - 1].color;

  for (let i = 0; i < sorted.length - 1; i++) {
    if (t >= sorted[i].position && t <= sorted[i + 1].position) {
      const range = sorted[i + 1].position - sorted[i].position;
      const localT = range === 0 ? 0 : (t - sorted[i].position) / range;
      const [r1, g1, b1] = hexToRgb(sorted[i].color);
      const [r2, g2, b2] = hexToRgb(sorted[i + 1].color);
      return rgbToHex(
        r1 + (r2 - r1) * localT,
        g1 + (g2 - g1) * localT,
        b1 + (b2 - b1) * localT,
      );
    }
  }

  return sorted[sorted.length - 1].color;
}

export function gradientToCSS(stops: GradientStop[]): string {
  const sorted = [...stops].sort((a, b) => a.position - b.position);
  const parts = sorted.map(s => `${s.color} ${(s.position * 100).toFixed(1)}%`);
  return `linear-gradient(to right, ${parts.join(', ')})`;
}

// WKS Brand Colors
export const WKS_YELLOW = '#D1FA17';
export const WKS_RED    = '#E71B1E';
export const WKS_BLUE   = '#432CC2';
export const WKS_TEAL   = '#00F2FF';

// Legacy aliases (keep for backwards compat in case anything references them)
export const WKS_PURPLE = WKS_BLUE;
export const WKS_CYAN   = WKS_TEAL;
export const WKS_LIME   = WKS_YELLOW;

export const WKS_BLACK  = '#000000';
export const WKS_WHITE  = '#ffffff';

/** Creates the default 10-entry palette (4 solids + 6 gradients). First solid is selected. */
export function createDefaultPalette(): PaletteEntry[] {
  return [
    // Solids (4)
    {
      id: 'solid-yellow',
      name: 'Yellow',
      stops: [
        { position: 0, color: WKS_YELLOW },
        { position: 1, color: WKS_YELLOW },
      ],
      selected: true, // default selected
    },
    {
      id: 'solid-red',
      name: 'Red',
      stops: [
        { position: 0, color: WKS_RED },
        { position: 1, color: WKS_RED },
      ],
      selected: false,
    },
    {
      id: 'solid-blue',
      name: 'Blue',
      stops: [
        { position: 0, color: WKS_BLUE },
        { position: 1, color: WKS_BLUE },
      ],
      selected: false,
    },
    {
      id: 'solid-teal',
      name: 'Teal',
      stops: [
        { position: 0, color: WKS_TEAL },
        { position: 1, color: WKS_TEAL },
      ],
      selected: false,
    },
    // Gradients (6)
    {
      id: 'grad-yellow-red',
      name: 'Yellow → Red',
      stops: [
        { position: 0, color: WKS_YELLOW },
        { position: 1, color: WKS_RED },
      ],
      selected: false,
    },
    {
      id: 'grad-yellow-blue',
      name: 'Yellow → Blue',
      stops: [
        { position: 0, color: WKS_YELLOW },
        { position: 1, color: WKS_BLUE },
      ],
      selected: false,
    },
    {
      id: 'grad-yellow-teal',
      name: 'Yellow → Teal',
      stops: [
        { position: 0, color: WKS_YELLOW },
        { position: 1, color: WKS_TEAL },
      ],
      selected: false,
    },
    {
      id: 'grad-red-blue',
      name: 'Red → Blue',
      stops: [
        { position: 0, color: WKS_RED },
        { position: 1, color: WKS_BLUE },
      ],
      selected: false,
    },
    {
      id: 'grad-red-teal',
      name: 'Red → Teal',
      stops: [
        { position: 0, color: WKS_RED },
        { position: 1, color: WKS_TEAL },
      ],
      selected: false,
    },
    {
      id: 'grad-teal-blue',
      name: 'Teal → Blue',
      stops: [
        { position: 0, color: WKS_TEAL },
        { position: 1, color: WKS_BLUE },
      ],
      selected: false,
    },
  ];
}

/** Helper: get only the selected entries from a palette */
export function getSelectedEntries(palette: PaletteEntry[]): PaletteEntry[] {
  return palette.filter(e => e.selected);
}

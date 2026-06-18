// ── WKS hero brand palette ───────────────────────────────
// Pulled from the WKS_DesignSystem Figma file (Foundations › Colors).
// The 500 swatch of each family is the hero brand color.
// Figma: XRPN1PE7YOrnO4xif2A6ZA, node 1023:36350.

export interface BrandColor {
  name: string;
  hex: string;
}

// Hero colors — the 500 swatches.
export const BRAND_TEAL = '#15F2FE'; // primary / hero
export const BRAND_VIOLET = '#5741D3';
export const BRAND_RED = '#E82C2E';
export const BRAND_YELLOW = '#D1F91A';
export const BRAND_NEUTRAL = '#8A8A8A';

// Base neutrals.
export const BRAND_BLACK = '#000000';
export const BRAND_WHITE = '#FFFFFF';

// Quick-pick palette shown under each color control. Ordered dark → light
// so it reads as an ink/paper ramp with the hero hues between.
export const BRAND_SWATCHES: BrandColor[] = [
  { name: 'Black', hex: BRAND_BLACK },
  { name: 'Violet', hex: BRAND_VIOLET },
  { name: 'Red', hex: BRAND_RED },
  { name: 'Teal', hex: BRAND_TEAL },
  { name: 'Yellow', hex: BRAND_YELLOW },
  { name: 'Neutral', hex: BRAND_NEUTRAL },
  { name: 'White', hex: BRAND_WHITE },
];

/**
 * Minimal OKLCH → sRGB conversion and WCAG contrast maths.
 * Used by the contrast test (AC #9); no runtime dependency on it.
 * Matrices from Björn Ottosson's OKLab reference implementation.
 */

export interface Oklch {
  /** Lightness 0..1 */
  l: number;
  /** Chroma ≥ 0 */
  c: number;
  /** Hue in degrees */
  h: number;
}

export interface Rgb {
  /** Gamma-encoded sRGB components 0..1 */
  r: number;
  g: number;
  b: number;
}

/** Parse `oklch(L C H)` — L as a percentage or 0..1 number, optional `deg` on H, optional alpha ignored. */
export function parseOklch(value: string): Oklch {
  const match = value.trim().match(/^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?\s*(?:\/\s*[\d.%]+\s*)?\)$/i);
  if (!match) throw new Error(`not an oklch() literal: ${value}`);
  const rawL = Number(match[1]);
  const l = match[2] === '%' ? rawL / 100 : rawL;
  return { l, c: Number(match[3]), h: Number(match[4]) };
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

function linearToGamma(c: number): number {
  const v = clamp01(c);
  return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}

function gammaToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** OKLCH → linear sRGB (unclamped, may leave the gamut). */
function oklchToLinearSrgb({ l, c, h }: Oklch): Rgb {
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr);
  const b = c * Math.sin(hr);

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const L = l_ * l_ * l_;
  const M = m_ * m_ * m_;
  const S = s_ * s_ * s_;

  return {
    r: 4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    g: -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    b: -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
  };
}

/** OKLCH → gamma-encoded sRGB, clamped to the gamut. Tiny negative noise is rounded to exact 0/1. */
export function oklchToSrgb(color: Oklch): Rgb {
  const lin = oklchToLinearSrgb(color);
  const round = (x: number) => Math.round(x * 1e6) / 1e6;
  return { r: round(linearToGamma(lin.r)), g: round(linearToGamma(lin.g)), b: round(linearToGamma(lin.b)) };
}

/** WCAG 2.x relative luminance of a gamma-encoded sRGB colour. */
export function relativeLuminance({ r, g, b }: Rgb): number {
  return 0.2126 * gammaToLinear(r) + 0.7152 * gammaToLinear(g) + 0.0722 * gammaToLinear(b);
}

/** WCAG contrast ratio, always ≥ 1. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [light, dark] = la >= lb ? [la, lb] : [lb, la];
  return (light + 0.05) / (dark + 0.05);
}

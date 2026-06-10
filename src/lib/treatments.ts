/**
 * Postcard photo color treatments — curated looks, not exact emulations.
 * Each is a Skia 4x5 color matrix (row-major RGBA, last column = bias in 0–1).
 * Grain is applied separately and independently (see TreatedPhoto + GrainSlider).
 */
export type Treatment = {
  key: string;
  label: string;
  /** Skia ColorMatrix: 20 values, rows R,G,B,A; each row [r,g,b,a,bias]. */
  matrix: number[];
};

// prettier-ignore
const IDENTITY = [
  1, 0, 0, 0, 0,
  0, 1, 0, 0, 0,
  0, 0, 1, 0, 0,
  0, 0, 0, 1, 0,
];

// Rec. 601 luma on every channel → neutral black & white.
// prettier-ignore
const BW = [
  0.299, 0.587, 0.114, 0, 0,
  0.299, 0.587, 0.114, 0, 0,
  0.299, 0.587, 0.114, 0, 0,
  0,     0,     0,     1, 0,
];

// prettier-ignore
const SEPIA = [
  0.393, 0.769, 0.189, 0, 0,
  0.349, 0.686, 0.168, 0, 0,
  0.272, 0.534, 0.131, 0, 0,
  0,     0,     0,     1, 0,
];

// Muted saturation (~0.85) with a warm-highlight lean — a Classic-Chrome-ish
// grade. Approximate, tuned by eye.
// prettier-ignore
const FUJI = [
  0.882, 0.107, 0.011, 0,  0.03,
  0.032, 0.957, 0.011, 0,  0.0,
  0.032, 0.107, 0.861, 0, -0.02,
  0,     0,     0,     1,  0,
];

export const TREATMENTS: Treatment[] = [
  { key: 'original', label: 'Original', matrix: IDENTITY },
  { key: 'bw', label: 'B&W', matrix: BW },
  { key: 'sepia', label: 'Sepia', matrix: SEPIA },
  { key: 'fuji', label: 'Fuji', matrix: FUJI },
];

export const DEFAULT_TREATMENT = TREATMENTS[0];

/** Maps the 0–1 grain slider to the grain shader's intensity. */
export const MAX_GRAIN = 0.4;

// Static luminance grain, blended 'overlay' so it adds tooth without shifting
// exposure (0.5 = neutral under overlay). Shared by the live preview
// (TreatedPhoto) and the send-time bake (bake-treatment) so the stored image
// matches what was on screen.
export const GRAIN_SKSL = `
uniform float intensity;
half4 main(float2 xy) {
  float n = fract(sin(dot(xy, float2(12.9898, 78.233))) * 43758.5453123);
  float v = 0.5 + (n - 0.5) * intensity;
  return half4(half3(v), 1.0);
}`;

/** A postcard photo's full look. `grain` is shader intensity (slider value × MAX_GRAIN). */
export type Look = {
  treatment: Treatment;
  grain: number;
};

/** True when applying the look would be a no-op (Original treatment, no grain). */
export function isUntreated({ treatment, grain }: Look): boolean {
  return treatment.key === DEFAULT_TREATMENT.key && grain <= 0;
}

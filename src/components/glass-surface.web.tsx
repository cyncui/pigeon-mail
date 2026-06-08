import type { CSSProperties, ReactNode } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

export const LIQUID_GLASS = false;

type Props = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  tint?: string;
  interactive?: boolean;
  /** Drives the refraction strength. */
  intensity?: number;
};

/**
 * Web glass surface with genuine backdrop refraction + the glossy passes.
 *
 * - Refraction: fractal-noise `feTurbulence` → `feDisplacementMap` warps the
 *   backdrop via `backdrop-filter: url(...)`, the way real glass bends light.
 * - Chromatic fringe: R/G/B are displaced by slightly different amounts and
 *   recombined, so the warped edges split light into colour.
 * - Specular gloss: an inset rim highlight + a diagonal sheen gradient.
 *
 * Refraction + fringe work in Chromium (backdrop-filter: url()); Safari/Firefox
 * don't support that and quietly fall back to the blur + gloss.
 */
export function GlassSurface({ children, style, intensity = 30 }: Props) {
  const flat = StyleSheet.flatten(style) ?? {};
  const scale = Math.max(6, Math.round(intensity * 0.28)); // refraction strength
  const filterId = `pigeon-glass-${scale}`;

  return (
    <>
      <svg aria-hidden="true" width="0" height="0" style={{ position: 'absolute', pointerEvents: 'none' }}>
        <filter id={filterId} x="-40%" y="-40%" width="180%" height="180%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.012" numOctaves={2} seed={7} result="noise" />
          <feGaussianBlur in="noise" stdDeviation={1.4} result="map" />
          {/* chromatic aberration: displace each channel by a different amount */}
          <feDisplacementMap in="SourceGraphic" in2="map" scale={scale} xChannelSelector="R" yChannelSelector="G" result="dR" />
          <feDisplacementMap in="SourceGraphic" in2="map" scale={scale * 0.85} xChannelSelector="R" yChannelSelector="G" result="dG" />
          <feDisplacementMap in="SourceGraphic" in2="map" scale={scale * 0.7} xChannelSelector="R" yChannelSelector="G" result="dB" />
          <feColorMatrix in="dR" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" />
          <feColorMatrix in="dG" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g" />
          <feColorMatrix in="dB" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b" />
          <feBlend in="r" in2="g" mode="screen" result="rg" />
          <feBlend in="rg" in2="b" mode="screen" />
        </filter>
      </svg>
      <div
        style={{
          ...(flat as unknown as CSSProperties),
          pointerEvents: 'none',
          background:
            'linear-gradient(150deg, rgba(255,255,255,0.22), rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.12))',
          backdropFilter: `blur(2px) url(#${filterId})`,
          WebkitBackdropFilter: `blur(2px) url(#${filterId})`,
          boxShadow:
            'inset 1px 1px 1.5px rgba(255,255,255,0.55), inset -1px -2px 3px rgba(120,94,56,0.1), 0 2px 6px rgba(63,46,34,0.12)',
        }}
      >
        {children}
      </div>
    </>
  );
}

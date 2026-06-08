import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

/** True only where native Liquid Glass exists (iOS 26+). */
export const LIQUID_GLASS = isLiquidGlassAvailable();

type Props = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Optional tint for the glass surface. */
  tint?: string;
  /** Enables the interactive liquid response (iOS). */
  interactive?: boolean;
  /** Blur strength (0–100) for the fallback surface. Native Liquid Glass ignores it. */
  intensity?: number;
};

/**
 * A reusable glass surface — the shared treatment for all buttons and menus.
 * Uses native Liquid Glass on iOS 26+, and falls back to a frosted blur
 * everywhere else (web, Android, older iOS), where GlassView would otherwise
 * render as an invisible plain View.
 */
export function GlassSurface({ children, style, tint, interactive, intensity = 30 }: Props) {
  if (LIQUID_GLASS) {
    return (
      <GlassView style={style} glassEffectStyle="regular" tintColor={tint} isInteractive={interactive}>
        {children}
      </GlassView>
    );
  }

  return (
    <BlurView intensity={intensity} tint="light" style={style}>
      {children}
    </BlurView>
  );
}

import '@/global.css';

import { Platform } from 'react-native';

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** Hand of Cynthia — the maker's own handwriting, bundled via useAppFonts().
     * Single style; the italic slot shares it. */
    serif: 'HandOfCynthia',
    serifItalic: 'HandOfCynthia',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
    /** Ioskeley Mono, loaded from the bundled TTF via useAppFonts(). */
    caption: 'IoskeleyMono',
    /** Lovers Quarrel — handwriting for everything "written" on a postcard.
     * Small-bodied calligraphy: sizes run ~1.5× what a normal face would use. */
    script: 'LoversQuarrel',
  },
  default: {
    sans: 'normal',
    serif: 'HandOfCynthia',
    serifItalic: 'HandOfCynthia',
    rounded: 'normal',
    mono: 'monospace',
    caption: 'IoskeleyMono',
    script: 'LoversQuarrel',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    serifItalic: 'var(--font-serif-italic)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
    caption: 'var(--font-caption)',
    script: 'var(--font-script)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

/**
 * Pigeon Mail brand palette — fixed design colors (not light/dark adaptive).
 * Read from the Figma capture; confirm exact hexes in Figma → Dev Mode → Inspect.
 */
export const Brand = {
  cream: '#FFF5E1', // Brand/Cream — screen background
  cream60: 'rgba(255, 245, 225, 0.6)', // cream at 60% — controls on a dark overlay
  cream20: 'rgba(255, 245, 225, 0.2)', // cream at 20% — borders/tracks on dark
  cream12: 'rgba(255, 245, 225, 0.12)', // cream at 12% — fills on dark
  brown: '#3F2E22', // Brand/Brown — title, captions, frames, create button
  brown60: 'rgba(63, 46, 34, 0.6)', // Brand/Brown 60%
  brown10: 'rgba(63, 46, 34, 0.1)', // Brand/Brown 10%
  stamp: '#FFFFFF', // white postage-stamp border (legacy)
  paper: '#F3EAD6', // warm ivory card stock — the postcard "paper"
  print: 'rgba(120, 94, 56, 0.1)', // warm matte veil over photos to read as a print
} as const;

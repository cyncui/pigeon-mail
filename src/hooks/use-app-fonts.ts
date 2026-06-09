import { useFonts } from 'expo-font';

/**
 * Loads the bundled custom fonts on native — Ioskeley Mono (captions) and Art
 * Company Mono (the display "serif", regular + italic). On web these are served
 * via `@font-face` in global.css, so the `.web` variant is a no-op and the font
 * files never ship in the web bundle.
 */
export function useAppFonts(): boolean {
  const [loaded] = useFonts({
    IoskeleyMono: require('@/assets/fonts/IoskeleyMono-Regular.ttf'),
    ArtCompanyMono: require('@/assets/fonts/ArtCompanyMono-Regular.otf'),
    'ArtCompanyMono-Italic': require('@/assets/fonts/ArtCompanyMono-Italic.otf'),
  });
  return loaded;
}

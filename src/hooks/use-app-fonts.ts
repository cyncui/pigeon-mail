import { useFonts } from 'expo-font';

/**
 * Loads the bundled custom fonts on native — Ioskeley Mono (captions), Hand of
 * Cynthia (the display "serif": the maker's own handwriting), and Lovers
 * Quarrel (postcard script). On web these are served via `@font-face` in
 * global.css, so the `.web` variant is a no-op and the font files never ship
 * in the web bundle.
 */
export function useAppFonts(): boolean {
  const [loaded] = useFonts({
    IoskeleyMono: require('@/assets/fonts/IoskeleyMono-Regular.ttf'),
    HandOfCynthia: require('@/assets/fonts/HandOfCynthia-Regular.otf'),
    LoversQuarrel: require('@/assets/fonts/LoversQuarrel-Regular.ttf'),
  });
  return loaded;
}

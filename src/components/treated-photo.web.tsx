import { WithSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
import { Image } from 'expo-image';

import type { TreatedPhotoProps } from './treated-photo-skia';

/**
 * The Skia treatment needs CanvasKit (≈8MB), which we do NOT want to block the
 * create modal's entrance on. So the studio renders immediately and `WithSkiaWeb`
 * loads CanvasKit + the Skia component lazily the first time a photo is shown —
 * forwarding props via `componentProps`. Until it's ready we show the plain image
 * (the default treatment is Original, so the hand-off is seamless).
 */
export function TreatedPhoto(props: TreatedPhotoProps) {
  return (
    <WithSkiaWeb<TreatedPhotoProps>
      getComponent={() => import('./treated-photo-skia').then((m) => ({ default: m.TreatedPhoto }))}
      componentProps={props}
      fallback={
        <Image source={{ uri: props.uri }} style={{ width: props.width, height: props.height }} contentFit="cover" />
      }
    />
  );
}

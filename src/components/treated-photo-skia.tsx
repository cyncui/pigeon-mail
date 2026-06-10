import { Canvas, ColorMatrix, Fill, Image, Shader, Skia, useImage } from '@shopify/react-native-skia';

import { GRAIN_SKSL, type Treatment } from '@/lib/treatments';

// Compiled once; CanvasKit is guaranteed loaded because this module is only
// imported after Skia is ready.
const grainEffect = Skia.RuntimeEffect.Make(GRAIN_SKSL);

export type TreatedPhotoProps = {
  uri: string;
  width: number;
  height: number;
  treatment: Treatment;
  /** Grain shader intensity (already mapped from the 0–1 slider). */
  grain: number;
};

/** Renders the postcard photo through a Skia color matrix + independent film grain. */
export function TreatedPhoto({ uri, width, height, treatment, grain }: TreatedPhotoProps) {
  const image = useImage(uri);
  if (!image) return null;

  return (
    <Canvas style={{ width, height }}>
      <Image image={image} x={0} y={0} width={width} height={height} fit="cover">
        <ColorMatrix matrix={treatment.matrix} />
      </Image>
      {grain > 0 && grainEffect ? (
        <Fill blendMode="overlay">
          <Shader source={grainEffect} uniforms={{ intensity: grain }} />
        </Fill>
      ) : null}
    </Canvas>
  );
}

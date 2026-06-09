import { Canvas, ColorMatrix, Fill, Image, Shader, Skia, useImage } from '@shopify/react-native-skia';

import type { Treatment } from '@/lib/treatments';

// Static luminance grain, blended 'overlay' so it adds tooth without shifting
// exposure (0.5 = neutral under overlay). Compiled once; CanvasKit is guaranteed
// loaded because this module is only imported after Skia is ready.
const grainEffect = Skia.RuntimeEffect.Make(`
uniform float intensity;
half4 main(float2 xy) {
  float n = fract(sin(dot(xy, float2(12.9898, 78.233))) * 43758.5453123);
  float v = 0.5 + (n - 0.5) * intensity;
  return half4(half3(v), 1.0);
}`);

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

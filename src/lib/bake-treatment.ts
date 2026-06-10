import { BlendMode, ImageFormat, Skia, type SkImage, type SkSurface } from '@shopify/react-native-skia';

import { GRAIN_SKSL, type Look } from '@/lib/treatments';

/**
 * Renders a photo through its chosen treatment (color matrix + grain) offscreen
 * and encodes the result, so the stored postcard image matches the studio
 * preview pixel-for-pixel in look. Mirrors TreatedPhoto's drawing exactly:
 * same decode path, same color matrix, same grain shader and overlay blend.
 *
 * Web contract: never import this module statically from web-resolved code —
 * Skia's web entry binds global.CanvasKit at module load. Dynamic-import it
 * after `LoadSkiaWeb()` resolves (see persist-image.web.ts), the same pattern
 * treated-photo.web.tsx uses.
 */

let grainEffect: ReturnType<typeof Skia.RuntimeEffect.Make> | undefined;
const getGrainEffect = () => (grainEffect ??= Skia.RuntimeEffect.Make(GRAIN_SKSL));

/**
 * Decode → cap the long edge to maxDim → draw with the treatment's color
 * matrix (Mitchell cubic resampling) → grain overlay → snapshot. The photo is
 * baked uncropped at its own aspect ratio; frames cover-fit it at display time.
 * Returns null on any failure so callers can fall back to the raw image.
 */
async function renderTreated(srcUri: string, look: Look, maxDim: number) {
  const data = await Skia.Data.fromURI(srcUri);
  const src = Skia.Image.MakeImageFromEncoded(data);
  data.dispose();
  if (!src) return null;

  const scale = Math.min(1, maxDim / Math.max(src.width(), src.height()));
  const width = Math.max(1, Math.round(src.width() * scale));
  const height = Math.max(1, Math.round(src.height() * scale));

  // CPU raster surface: reliable on both platforms (MakeOffscreen throws on
  // web without WebGL) and its snapshot encodes directly.
  const surface = Skia.Surface.Make(width, height);
  if (!surface) {
    src.dispose();
    return null;
  }

  const canvas = surface.getCanvas();
  const paint = Skia.Paint();
  paint.setColorFilter(Skia.ColorFilter.MakeMatrix(look.treatment.matrix));
  canvas.drawImageRectCubic(
    src,
    Skia.XYWHRect(0, 0, src.width(), src.height()),
    Skia.XYWHRect(0, 0, width, height),
    1 / 3,
    1 / 3,
    paint,
  );
  src.dispose();

  if (look.grain > 0) {
    const effect = getGrainEffect();
    if (effect) {
      const grainPaint = Skia.Paint();
      grainPaint.setShader(effect.makeShader([look.grain]));
      grainPaint.setBlendMode(BlendMode.Overlay);
      canvas.drawPaint(grainPaint);
    }
  }

  surface.flush();
  return { surface, image: surface.makeImageSnapshot() };
}

// Encode before disposing the surface — CPU snapshots are copy-on-write.
function finish<T>(rendered: { surface: SkSurface; image: SkImage }, encode: (image: SkImage) => T): T {
  const out = encode(rendered.image);
  rendered.image.dispose();
  rendered.surface.dispose();
  return out;
}

export async function bakeTreatedJpegBytes(
  srcUri: string,
  look: Look,
  maxDim: number,
  quality: number,
): Promise<Uint8Array | null> {
  try {
    const rendered = await renderTreated(srcUri, look, maxDim);
    if (!rendered) return null;
    return finish(rendered, (image) => image.encodeToBytes(ImageFormat.JPEG, quality) ?? null);
  } catch {
    return null;
  }
}

export async function bakeTreatedJpegBase64(
  srcUri: string,
  look: Look,
  maxDim: number,
  quality: number,
): Promise<string | null> {
  try {
    const rendered = await renderTreated(srcUri, look, maxDim);
    if (!rendered) return null;
    return finish(rendered, (image) => image.encodeToBase64(ImageFormat.JPEG, quality) || null);
  } catch {
    return null;
  }
}

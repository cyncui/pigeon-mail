import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

import { isUntreated, type Look } from '@/lib/treatments';

/**
 * Web counterpart to persist-image.ts. expo-file-system has no web backend, so
 * there is nothing to copy: instead we bake the photo into a downscaled,
 * self-contained `data:` URI that survives a reload as a plain string in
 * storage. Downscaling keeps it well under the ~5 MB localStorage quota.
 * Keep both signatures identical; TypeScript does not cross-check
 * platform-split modules.
 *
 * When a `look` is given and isn't a no-op, the treatment is baked into the
 * pixels via Skia (CanvasKit) so the feed shows exactly what was previewed.
 * bake-treatment is imported dynamically only after `LoadSkiaWeb()` resolves —
 * Skia's web entry needs global.CanvasKit at module load (same pattern as
 * treated-photo.web.tsx). Importing LoadSkiaWeb itself is safe: that module
 * only exposes the CanvasKit init function.
 *
 * The picked URI is the user's own file (a blob:/data: URL), so the canvas is
 * never cross-origin-tainted and `toDataURL` is safe.
 */
const MAX_DIM = 1200;
const QUALITY = 0.82; // canvas.toDataURL scale, 0–1
const BAKE_QUALITY = 82; // Skia JPEG quality, 0–100 (≈ QUALITY)

export async function persistImage(srcUri: string, _id: string, look?: Look): Promise<string> {
  if (look && !isUntreated(look)) {
    try {
      // Idempotent; instant when the studio preview already loaded CanvasKit.
      await LoadSkiaWeb();
      const { bakeTreatedJpegBase64 } = await import('./bake-treatment');
      const b64 = await bakeTreatedJpegBase64(srcUri, look, MAX_DIM, BAKE_QUALITY);
      if (b64) return `data:image/jpeg;base64,${b64}`;
    } catch {
      // fall through to the untreated downscale so sending never breaks
    }
  }

  try {
    return await downscaleToDataUri(srcUri);
  } catch {
    return srcUri; // fall back to the live URI if canvas isn't available
  }
}

function downscaleToDataUri(uri: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
      const width = Math.max(1, Math.round(img.width * scale));
      const height = Math.max(1, Math.round(img.height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', QUALITY));
    };
    img.onerror = () => reject(new Error('Image failed to load'));
    img.src = uri;
  });
}

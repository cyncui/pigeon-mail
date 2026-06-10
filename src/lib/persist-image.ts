import { Directory, File, Paths } from 'expo-file-system';

import { bakeTreatedJpegBytes } from '@/lib/bake-treatment';
import { isUntreated, type Look } from '@/lib/treatments';

// Bake size comfortably exceeds a Lob 4×6 print at 300dpi (1800×1200) while
// keeping the offscreen surface ~12MB.
const BAKE_MAX_DIM = 2048;
const BAKE_QUALITY = 90; // Skia JPEG quality, 0–100

/**
 * Persist a freshly-picked photo out of the temporary picker cache (which the
 * OS can purge) into the app's document directory, so a saved postcard still
 * has its image after a restart. Returns the durable `file://` URI.
 *
 * When a `look` is given and isn't a no-op, the treatment is baked into the
 * stored pixels (offscreen Skia render) so the feed — and the eventual print —
 * shows exactly what was previewed. If baking fails we fall back to copying
 * the raw photo so sending never breaks.
 *
 * Web has no expo-file-system backend — see persist-image.web.ts, which keeps
 * the image as a self-contained `data:` URI instead. Keep both signatures
 * identical; TypeScript does not cross-check platform-split modules.
 */
export async function persistImage(srcUri: string, id: string, look?: Look): Promise<string> {
  const dir = new Directory(Paths.document, 'postcards');
  if (!dir.exists) dir.create({ intermediates: true });

  if (look && !isUntreated(look)) {
    const bytes = await bakeTreatedJpegBytes(srcUri, look, BAKE_MAX_DIM, BAKE_QUALITY);
    if (bytes) {
      const dest = new File(dir, `${id}.jpg`);
      if (dest.exists) dest.delete();
      dest.write(bytes);
      return dest.uri;
    }
  }

  const src = new File(srcUri);
  const ext = src.extension || '.jpg'; // `extension` includes the leading dot
  const dest = new File(dir, `${id}${ext}`);
  if (dest.exists) dest.delete();

  await src.copy(dest);
  return dest.uri;
}

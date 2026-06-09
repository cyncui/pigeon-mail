// Native: Skia runs directly, so the studio can import the implementation as-is.
// On web, treated-photo.web.tsx lazy-loads CanvasKit instead (see that file).
export { TreatedPhoto } from './treated-photo-skia';
export type { TreatedPhotoProps } from './treated-photo-skia';

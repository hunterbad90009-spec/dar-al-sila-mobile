export function replacePhotoAtIndex(photos: string[], index: number, replacement: string): string[] {
  if (!Number.isInteger(index) || index < 0 || index >= photos.length || !replacement) return photos;
  const next = [...photos];
  next[index] = replacement;
  return next;
}

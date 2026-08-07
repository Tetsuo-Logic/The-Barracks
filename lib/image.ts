// Client-side image compression (§7). A modern phone photo is 4–8MB; three
// players on a free tier exhaust storage fast. Draw to a canvas at longest edge
// 1600px, JPEG 0.72 — ~250KB with no visible loss on a phone. EXIF is dropped
// by the canvas; orientation is applied first via createImageBitmap.

const MAX_EDGE = 1600;
const QUALITY = 0.72;

export type Compressed = { blob: Blob; width: number; height: number };

export async function compressImage(file: File): Promise<Compressed> {
  // imageOrientation: 'from-image' bakes EXIF rotation into the pixels so
  // photos don't land sideways (§7).
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });

  let { width, height } = bitmap;
  if (width > height && width > MAX_EDGE) {
    height = Math.round((height * MAX_EDGE) / width);
    width = MAX_EDGE;
  } else if (height >= width && height > MAX_EDGE) {
    width = Math.round((width * MAX_EDGE) / height);
    height = MAX_EDGE;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", QUALITY),
  );
  if (!blob) throw new Error("Compression failed");

  return { blob, width, height };
}

/** Centre-crop to a square and shrink — for round profile avatars (§5). */
export async function compressToSquare(file: File, size = 512): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.8),
  );
  if (!blob) throw new Error("Compression failed");
  return blob;
}

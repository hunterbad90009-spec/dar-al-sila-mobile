import { Platform } from "react-native";
import * as ImageManipulator from "expo-image-manipulator";

import { readImageAsDataUrl } from "@/lib/read-image-data-url";

const MAX_WIDTH = 1400;
const JPEG_QUALITY = 0.72;

async function prepareWebImage(uri: string): Promise<string> {
  const source = await readImageAsDataUrl(uri);
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new window.Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("IMAGE_DECODE_FAILED"));
    element.src = source;
  });

  const scale = Math.min(1, MAX_WIDTH / Math.max(image.naturalWidth || image.width, 1));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
  canvas.height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("IMAGE_CANVAS_UNAVAILABLE");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  let quality = JPEG_QUALITY;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);
  while (dataUrl.length > 1_850_000 && quality > 0.4) {
    quality -= 0.08;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }
  if (dataUrl.length > 1_850_000) {
    const reduced = document.createElement("canvas");
    reduced.width = Math.max(1, Math.round(canvas.width * 0.75));
    reduced.height = Math.max(1, Math.round(canvas.height * 0.75));
    const reducedContext = reduced.getContext("2d");
    if (!reducedContext) throw new Error("IMAGE_CANVAS_UNAVAILABLE");
    reducedContext.drawImage(image, 0, 0, reduced.width, reduced.height);
    dataUrl = reduced.toDataURL("image/jpeg", 0.55);
  }
  return dataUrl;
}

/** Normalize selected images before upload so the server byte limit is respected. */
export async function prepareImageDataUrl(uri: string): Promise<string> {
  if (Platform.OS === "web") return prepareWebImage(uri);
  const prepared = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: MAX_WIDTH } }],
    { compress: JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG },
  );
  return readImageAsDataUrl(prepared.uri);
}

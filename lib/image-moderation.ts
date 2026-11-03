export type ImageModerationVerdict = "allow" | "reject" | "review";

export type ImageModerationResult = {
  verdict: ImageModerationVerdict;
  safeToPublish?: boolean;
  confidence?: number;
};

export function isSupportedImageDataUrl(value: string): boolean {
  if (value.length > 2_000_000) return false;
  const match = /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!match) return false;
  const mime = match[1] === "jpg" ? "jpeg" : match[1];
  try {
    const bytes = decodeBase64Prefix(match[2], 16);
    const isJpeg = mime === "jpeg" && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const isPng = mime === "png" && bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10";
    const isWebp = mime === "webp" && bytes.slice(0, 4).join(",") === "82,73,70,70" && bytes.slice(8, 12).join(",") === "87,69,66,80";
    return isJpeg || isPng || isWebp;
  } catch {
    return false;
  }
}

function decodeBase64Prefix(encoded: string, maxBytes: number): number[] {
  const normalized = encoded.replace(/=+$/, "");
  const bytes: number[] = [];
  for (let i = 0; i < normalized.length && bytes.length < maxBytes; i += 4) {
    const a = BASE64.indexOf(normalized[i]);
    const b = BASE64.indexOf(normalized[i + 1]);
    const c = BASE64.indexOf(normalized[i + 2]);
    const d = BASE64.indexOf(normalized[i + 3]);
    if (a < 0 || b < 0) throw new Error("INVALID_BASE64");
    bytes.push((a << 2) | (b >> 4));
    if (c >= 0 && bytes.length < maxBytes) bytes.push(((b & 15) << 4) | (c >> 2));
    if (d >= 0 && bytes.length < maxBytes) bytes.push(((c & 3) << 6) | d);
  }
  return bytes;
}

const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function shouldPublishImage(result: ImageModerationResult): boolean {
  return result.verdict === "allow" && result.safeToPublish === true && typeof result.confidence === "number" && result.confidence >= 0.9;
}

import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";

export async function readImageAsDataUrl(uri: string): Promise<string> {
  if (Platform.OS === "web") {
    const blob = await (await fetch(uri)).blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("IMAGE_READ_FAILED"));
      reader.onerror = () => reject(new Error("IMAGE_READ_FAILED"));
      reader.readAsDataURL(blob);
    });
  }
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  const extension = uri.split("?")[0].split(".").pop()?.toLowerCase();
  const mime = extension === "png" ? "png" : extension === "webp" ? "webp" : "jpeg";
  return `data:image/${mime};base64,${base64}`;
}

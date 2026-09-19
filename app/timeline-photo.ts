export const TIMELINE_PHOTO_WIDTH = 680;
export const TIMELINE_PHOTO_QUALITY = 80;
export const TIMELINE_PHOTO_PREFIX = "timeline/optimized-v1/";

export type ImagesBinding = {
  input(stream: ReadableStream): {
    transform(options: { width: number; fit: "scale-down" }): {
      output(options: { format: "image/webp"; quality: number; anim: boolean }):
        Promise<{ response(): Response }>;
    };
  };
};

export type StoredTimelinePhoto = { key: string; name: string; contentType: string };

export async function optimizeTimelinePhoto(file: File, images?: ImagesBinding) {
  if (!images) throw new Error("画像の最適化サービスが利用できません。時間をおいて再度お試しください。");
  try {
    const result = await images.input(file.stream())
      .transform({ width: TIMELINE_PHOTO_WIDTH, fit: "scale-down" })
      .output({ format: "image/webp", quality: TIMELINE_PHOTO_QUALITY, anim: true });
    const response = result.response();
    if (!response.ok) throw new Error("Image conversion failed");
    const bytes = await response.arrayBuffer();
    if (!bytes.byteLength) throw new Error("Empty image");
    return {
      bytes,
      key: `${TIMELINE_PHOTO_PREFIX}${crypto.randomUUID()}.webp`,
      name: `${file.name.replace(/\.[^.]+$/, "") || "photo"}.webp`,
      contentType: "image/webp",
    };
  } catch {
    throw new Error("画像を変換できませんでした。破損していない対応形式の画像（JPEG・PNG・WebPなど）を選んでください。");
  }
}

// Cleanup only after checking current database references. A failed cleanup must
// not turn an already committed save into an apparent failure for the user.
export async function commitTimelinePhotoChange(
  photo: StoredTimelinePhoto | null,
  oldKey: string | null,
  persist: () => Promise<void>,
  removeIfUnreferenced: (key: string) => Promise<void>,
) {
  const cleanup = async (key: string) => {
    try { await removeIfUnreferenced(key); }
    catch { console.error("Timeline photo cleanup failed; retry during maintenance.", key); }
  };
  try {
    await persist();
  } catch (error) {
    if (photo) await cleanup(photo.key);
    throw error;
  }
  if (photo && oldKey && oldKey !== photo.key) await cleanup(oldKey);
}

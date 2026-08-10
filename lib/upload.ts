import imageCompression from "browser-image-compression";

export async function compressImage(file: File) {
  const options = {
    maxSizeMB: 0.5,            // target ~0.5MB max
    maxWidthOrHeight: 1400,    // plenty for product/hero/category display
    initialQuality: 0.82,
    useWebWorker: true,
    fileType: "image/webp",
  };
  try {
    return await imageCompression(file, options);
  } catch (error) {
    console.error("Compression error:", error);
    return file; // fall back to original if compression fails
  }
}

export function getPublicUrl(bucket: string, path: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
}

// Compress + upload an image to the diamond-products bucket and return its public
// URL. Shared by admin product images and campaign/marketing email images.
export async function uploadImage(file: File, folder = ""): Promise<string> {
  const { supabase } = await import("@/lib/supabase");
  const compressed = await compressImage(file);
  const safe = file.name.replace(/[^a-z0-9.]/gi, "_").toLowerCase();
  const path = `${folder ? folder.replace(/\/$/, "") + "/" : ""}${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${safe}`;
  const { error } = await supabase.storage.from("diamond-products").upload(path, compressed);
  if (error) throw error;
  return getPublicUrl("diamond-products", path);
}

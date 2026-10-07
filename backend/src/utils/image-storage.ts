import { createHash } from "crypto";
import { supabaseAdmin } from "../config/supabase";

/**
 * Images used to be saved in the database as base64 data URLs, which made every
 * catalog response weigh ~1 MB. They now go to a public Supabase Storage bucket
 * and only the URL is stored.
 */
export const IMAGES_BUCKET = process.env.SUPABASE_IMAGES_BUCKET || "images";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const DATA_URL_RE = /^data:image\/(png|jpe?g|webp|gif);base64,([A-Za-z0-9+/=\s]+)$/i;
const EXTENSIONS: Record<string, string> = { png: "png", jpg: "jpg", jpeg: "jpg", webp: "webp", gif: "gif" };

export function isInlineImage(value: unknown): value is string {
  return typeof value === "string" && /^data:image\//i.test(value.trim());
}

let bucketReady: Promise<void> | null = null;

function ensureBucket(): Promise<void> {
  if (!bucketReady) {
    bucketReady = (async () => {
      const { data } = await supabaseAdmin.storage.getBucket(IMAGES_BUCKET);
      if (data) return;
      const { error } = await supabaseAdmin.storage.createBucket(IMAGES_BUCKET, {
        public: true,
        fileSizeLimit: MAX_IMAGE_BYTES,
        allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"],
      });
      if (error && !/already exists/i.test(error.message)) throw new Error(error.message);
    })().catch((err) => {
      bucketReady = null; // retry on the next upload
      throw err;
    });
  }
  return bucketReady;
}

/**
 * Uploads a base64 data URL and returns its public URL. Any other value (http URL,
 * empty string, unsupported type) is returned unchanged. The object name is the
 * SHA-256 of the content, so the same image is stored once and re-runs are no-ops.
 */
export async function storeImage(value: string, folder: string): Promise<string> {
  if (!isInlineImage(value)) return value;
  const match = value.trim().match(DATA_URL_RE);
  if (!match) return value; // e.g. SVG: keep as before rather than serving it from our bucket

  const ext = EXTENSIONS[match[1].toLowerCase()];
  const bytes = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (bytes.length === 0) return value;
  if (bytes.length > MAX_IMAGE_BYTES) throw new Error("Imagem muito grande (máximo 10 MB).");

  await ensureBucket();
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 40);
  const path = `${folder}/${hash}.${ext}`;
  const { error } = await supabaseAdmin.storage.from(IMAGES_BUCKET).upload(path, bytes, {
    contentType: `image/${ext === "jpg" ? "jpeg" : ext}`,
    cacheControl: "31536000", // content-addressed: the file at this path never changes
    upsert: true,
  });
  if (error) throw new Error(`Falha ao salvar imagem: ${error.message}`);
  return supabaseAdmin.storage.from(IMAGES_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** storeImage for optional fields: undefined/null pass through. */
export async function storeOptionalImage<T extends string | null | undefined>(value: T, folder: string): Promise<T | string> {
  return typeof value === "string" ? storeImage(value, folder) : value;
}

export async function storeImageList(values: unknown, folder: string): Promise<unknown> {
  if (!Array.isArray(values)) return values;
  return Promise.all(values.map((v) => (typeof v === "string" ? storeImage(v, folder) : v)));
}

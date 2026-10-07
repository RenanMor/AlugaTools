import { supabaseAdmin } from "../config/supabase";
import { CacheKeys, invalidate } from "./cache";
import { isInlineImage, storeImage } from "./image-storage";

/**
 * One-time move of images saved as base64 in the database to Supabase Storage.
 * Runs in the background when the server starts and is safe to re-run: it only
 * touches values that are still `data:image/...`, uploads each image before
 * replacing it, and leaves the value as it was if the upload fails.
 * Set MIGRATE_INLINE_IMAGES=false to skip it.
 */
const TARGETS: { table: string; columns: string[]; folder: string }[] = [
  { table: "tools", columns: ["image", "image_url", "images"], folder: "tools" },
  { table: "companies", columns: ["logo"], folder: "companies" },
  { table: "users", columns: ["avatar_url"], folder: "companies" },
  { table: "rentals", columns: ["delivery_photos"], folder: "deliveries" },
];

// Rows still holding base64 images can weigh several MB each: keep pages small.
const PAGE_SIZE = 5;

/** Returns the migrated value, or undefined when nothing changes. */
export async function migrateValue(value: unknown, folder: string): Promise<unknown> {
  if (isInlineImage(value)) {
    const url = await storeImage(value, folder);
    return url !== value ? url : undefined;
  }
  if (Array.isArray(value) && value.some(isInlineImage)) {
    const next = await Promise.all(value.map((v) => (isInlineImage(v) ? storeImage(v, folder) : v)));
    return next.some((v, i) => v !== value[i]) ? next : undefined;
  }
  // Arrays saved as a JSON string in a text column
  if (typeof value === "string" && value.trim().startsWith("[") && value.includes("data:image")) {
    try {
      const parsed = JSON.parse(value);
      const next = await migrateValue(parsed, folder);
      return next === undefined ? undefined : JSON.stringify(next);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

async function migrateTable(
  { table, columns, folder }: (typeof TARGETS)[number],
  stats: { rows: number; failed: number },
): Promise<void> {
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select("*")
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      console.error(`[images] ${table}: could not read rows:`, error.message);
      return;
    }
    for (const row of data || []) {
      const updates: Record<string, unknown> = {};
      for (const column of columns) {
        if (!(column in row)) continue;
        try {
          const next = await migrateValue(row[column], folder);
          if (next !== undefined) updates[column] = next;
        } catch (err: any) {
          stats.failed++;
          console.error(`[images] ${table} ${row.id} ${column}: upload failed, kept as is:`, err?.message || err);
        }
      }
      if (Object.keys(updates).length === 0) continue;
      const { error: updateError } = await supabaseAdmin.from(table).update(updates).eq("id", row.id);
      if (updateError) {
        stats.failed++;
        console.error(`[images] ${table} ${row.id}: update failed:`, updateError.message);
      } else {
        stats.rows++;
      }
    }
    if (!data || data.length < PAGE_SIZE) return;
  }
}

export async function migrateInlineImages(): Promise<void> {
  if (process.env.MIGRATE_INLINE_IMAGES === "false") return;
  const started = Date.now();
  const summary: string[] = [];
  let migrated = 0;
  for (const target of TARGETS) {
    const stats = { rows: 0, failed: 0 };
    await migrateTable(target, stats);
    migrated += stats.rows;
    if (stats.rows || stats.failed) summary.push(`${target.table}: ${stats.rows} migrated, ${stats.failed} failed`);
  }
  if (migrated > 0) invalidate(CacheKeys.tools, CacheKeys.companies);
  console.log(
    `[images] inline image check done in ${Math.round((Date.now() - started) / 1000)}s` +
      (summary.length ? ` — ${summary.join("; ")}` : " — nothing to migrate"),
  );
}

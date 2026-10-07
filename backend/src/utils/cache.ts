/**
 * Small in-memory cache for read-heavy public data (catalog, featured companies).
 *
 * - Entries expire after `ttlMs`.
 * - Concurrent requests for the same key while it is loading share one database
 *   call, so a burst of visitors does not hit Supabase once per visitor.
 * - Writes call `invalidate(prefix)` so changes show up immediately on this instance.
 */
type Entry = { value: unknown; expiresAt: number };

const entries = new Map<string, Entry>();
const inFlight = new Map<string, Promise<unknown>>();
// Bumped on invalidation so a load that started before it is not stored afterwards.
let generation = 0;

export const CATALOG_TTL_MS = Number(process.env.CATALOG_CACHE_TTL_MS) || 30_000;

export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = entries.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value as T;

  const pending = inFlight.get(key);
  if (pending) return pending as Promise<T>;

  const startedAt = generation;
  const promise = load()
    .then((value) => {
      if (startedAt === generation) entries.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    })
    .finally(() => {
      if (inFlight.get(key) === promise) inFlight.delete(key);
    });
  inFlight.set(key, promise);
  return promise;
}

/** Drops every cached key that starts with one of the prefixes. */
export function invalidate(...prefixes: string[]): void {
  generation++;
  for (const key of [...entries.keys(), ...inFlight.keys()]) {
    if (prefixes.some((p) => key.startsWith(p))) {
      entries.delete(key);
      inFlight.delete(key);
    }
  }
}

export const CacheKeys = {
  tools: "tools:",
  companies: "companies:",
} as const;

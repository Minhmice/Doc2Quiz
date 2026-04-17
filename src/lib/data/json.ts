import type { Json } from "@/types/supabase";

/**
 * Convert arbitrary runtime data into a `jsonb`-safe value.
 *
 * Notes:
 * - Drops `undefined` object fields (standard JSON behavior).
 * - Converts `undefined` array elements to `null` (standard JSON behavior).
 * - Throws on values JSON can't represent (e.g. `bigint`, circular refs).
 */
export function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}


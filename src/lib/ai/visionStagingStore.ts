import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";

export const VISION_STAGING_MAX_BYTES = 12 * 1024 * 1024;
const TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 80;

type Entry = {
  bytes: Buffer;
  contentType: string;
  expires: number;
};

const store = new Map<string, Entry>();

function purgeExpired(): void {
  const now = Date.now();
  for (const [k, v] of store) {
    if (v.expires < now) {
      store.delete(k);
    }
  }
}

export function putVisionStaging(bytes: Buffer, contentType: string): string {
  purgeExpired();
  while (store.size >= MAX_ENTRIES) {
    const first = store.keys().next().value;
    if (first === undefined) {
      break;
    }
    store.delete(first);
  }
  const id = randomUUID();
  store.set(id, {
    bytes,
    contentType,
    expires: Date.now() + TTL_MS,
  });
  return id;
}

export function getVisionStaging(id: string): Entry | null {
  purgeExpired();
  const e = store.get(id);
  if (!e) {
    return null;
  }
  if (e.expires < Date.now()) {
    store.delete(id);
    return null;
  }
  return e;
}

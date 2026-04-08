import { pipelineLog } from "@/lib/logging/pipelineLogger";

let warnedRandomUuidMissing = false;
let warnedWeakFallback = false;

function uuidV4FromGetRandomValues(c: Pick<Crypto, "getRandomValues">): string {
  const bytes = new Uint8Array(16);
  c.getRandomValues(bytes);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function weakLocalHexUuid(): string {
  const chunk = (len: number) => {
    let s = "";
    for (let i = 0; i < len; i++) {
      s += Math.floor(Math.random() * 16).toString(16);
    }
    return s;
  };
  return `${chunk(8)}-${chunk(4)}-${chunk(4)}-${chunk(4)}-${chunk(12)}`;
}

/**
 * RFC 4122 UUID string suitable for IndexedDB primary keys.
 * Prefer `crypto.randomUUID` when present; otherwise build v4 from
 * `getRandomValues`; last resort uses Math.random (local-only collision risk).
 *
 * `randomUUID` is missing in some browsers, insecure contexts, or older
 * runtimes even when `crypto` exists.
 */
export function createRandomUuid(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }
  if (c && typeof c.getRandomValues === "function") {
    if (!warnedRandomUuidMissing) {
      warnedRandomUuidMissing = true;
      pipelineLog(
        "STUDY_SET",
        "id",
        "warn",
        "crypto.randomUUID unavailable; using getRandomValues UUIDv4",
        {
          hasCrypto: Boolean(c),
          randomUUIDType:
            c && "randomUUID" in c
              ? typeof (c as Crypto & { randomUUID?: unknown }).randomUUID
              : "absent",
        },
      );
    }
    return uuidV4FromGetRandomValues(c);
  }
  if (!warnedWeakFallback) {
    warnedWeakFallback = true;
    pipelineLog(
      "STUDY_SET",
      "id",
      "warn",
      "Web Crypto unavailable; using weak local UUID-shaped id",
      { hasCrypto: Boolean(c) },
    );
  }
  return weakLocalHexUuid();
}

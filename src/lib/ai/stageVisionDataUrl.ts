/**
 * Gateways often reject inline `data:image/...`. POST to `/api/ai/vision-staging` so
 * upstream gets an HTTPS URL (required for model image fetch).
 *
 * With `BLOB_READ_WRITE_TOKEN`: response `url` is a **public** Vercel Blob URL (same
 * staging API stays same-origin). Without token: `url` is this origin’s GET route;
 * server uses in-memory store with **~10 min TTL** and **max 80** entries (see
 * `visionStagingStore.ts`). **Blob objects are not auto-deleted** by this app—unlike
 * memory TTL—operators handle lifecycle (dashboard / policies / future job).
 */

export async function stageVisionDataUrlForUpstream(
  dataUrl: string,
  signal?: AbortSignal,
): Promise<{ url: string; staged: boolean }> {
  if (typeof window === "undefined") {
    return { url: dataUrl, staged: false };
  }

  try {
    const res = await fetch("/api/ai/vision-staging", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl }),
      signal,
    });
    if (!res.ok) {
      return { url: dataUrl, staged: false };
    }
    const j = (await res.json()) as { url?: string };
    if (typeof j.url === "string" && /^https?:\/\//i.test(j.url)) {
      return { url: j.url, staged: true };
    }
  } catch {
    /* network / abort */
  }
  return { url: dataUrl, staged: false };
}

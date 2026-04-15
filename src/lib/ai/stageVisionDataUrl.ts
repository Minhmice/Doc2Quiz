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

/** Appended to vision errors when only `data:` URLs were tried (no public staging). */
export const VISION_UPSTREAM_IMAGE_TIP =
  "Local dev: same-origin staging URLs are not fetchable by remote model servers. " +
  "Set BLOB_READ_WRITE_TOKEN (Vercel Blob) in .env.local so /api/ai/vision-staging returns a public HTTPS image URL, " +
  "or use an upstream that accepts data:image URLs.";

/**
 * True if `url` is an http(s) URL whose host is reachable by **remote** model
 * servers (not `localhost` / loopback). Same-origin staging on local dev fails
 * upstream fetch — set `BLOB_READ_WRITE_TOKEN` for a public Blob URL.
 */
export function isPublicHostedVisionImageUrl(url: string): boolean {
  if (!/^https?:\/\//i.test(url)) {
    return false;
  }
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host !== "localhost" &&
      host !== "127.0.0.1" &&
      host !== "[::1]"
    );
  } catch {
    return false;
  }
}

/**
 * Order for `image_url`: try `data:` first, then hosted URL only if publicly fetchable.
 * Skips same-origin localhost staging URLs (avoids a doomed retry + clearer errors).
 */
export function visionImageUrlTryOrder(
  dataUrl: string,
  staged: { url: string; staged: boolean },
): string[] {
  if (!staged.staged || !isPublicHostedVisionImageUrl(staged.url)) {
    return [dataUrl];
  }
  return [dataUrl, staged.url];
}

/** One URL per page for batch requests: prefer public hosted when available. */
export function primaryVisionImageUrlForUpstream(
  dataUrl: string,
  staged: { url: string; staged: boolean },
): string {
  if (staged.staged && isPublicHostedVisionImageUrl(staged.url)) {
    return staged.url;
  }
  return dataUrl;
}

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

const BATCH_CHUNK_SIZE = 20;

/**
 * Batch staging: send multiple data URLs in one request to `/api/ai/vision-staging`.
 * Chunks large batches into BATCH_CHUNK_SIZE requests. Falls back to sequential
 * single-image staging if batch request fails.
 */
export async function stageVisionDataUrlsBatch(
  dataUrls: string[],
  signal?: AbortSignal,
): Promise<Array<{ url: string; staged: boolean }>> {
  if (typeof window === "undefined") {
    return dataUrls.map((dataUrl) => ({ url: dataUrl, staged: false }));
  }

  if (dataUrls.length === 0) {
    return [];
  }

  // Single image → use existing function
  if (dataUrls.length === 1) {
    const result = await stageVisionDataUrlForUpstream(dataUrls[0], signal);
    return [result];
  }

  const results: Array<{ url: string; staged: boolean }> = [];

  // Process in chunks of BATCH_CHUNK_SIZE
  for (let i = 0; i < dataUrls.length; i += BATCH_CHUNK_SIZE) {
    const chunk = dataUrls.slice(i, i + BATCH_CHUNK_SIZE);

    try {
      const res = await fetch("/api/ai/vision-staging", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrls: chunk }),
        signal,
      });

      if (!res.ok) {
        // Fallback to sequential for this chunk
        console.warn(
          `[vision-staging] Batch request failed (${res.status}), falling back to sequential`,
        );
        for (const dataUrl of chunk) {
          const fallback = await stageVisionDataUrlForUpstream(dataUrl, signal);
          results.push(fallback);
        }
        continue;
      }

      const j = (await res.json()) as {
        results?: Array<{ url?: string; id?: string; error?: string }>;
      };

      if (!Array.isArray(j.results) || j.results.length !== chunk.length) {
        // Malformed response → fallback
        console.warn(
          "[vision-staging] Batch response malformed, falling back to sequential",
        );
        for (const dataUrl of chunk) {
          const fallback = await stageVisionDataUrlForUpstream(dataUrl, signal);
          results.push(fallback);
        }
        continue;
      }

      // Process batch results
      for (let idx = 0; idx < chunk.length; idx++) {
        const item = j.results[idx];
        const dataUrl = chunk[idx];

        if (
          item.error ||
          typeof item.url !== "string" ||
          !/^https?:\/\//i.test(item.url)
        ) {
          // This image failed → fallback to original dataUrl
          results.push({ url: dataUrl, staged: false });
        } else {
          results.push({ url: item.url, staged: true });
        }
      }
    } catch (e) {
      // Network error / abort → fallback to sequential for this chunk
      console.warn("[vision-staging] Batch request exception, falling back", e);
      for (const dataUrl of chunk) {
        try {
          const fallback = await stageVisionDataUrlForUpstream(dataUrl, signal);
          results.push(fallback);
        } catch {
          // Even fallback failed (likely abort) → use original dataUrl
          results.push({ url: dataUrl, staged: false });
        }
      }
    }
  }

  return results;
}

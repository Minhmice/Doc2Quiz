/**
 * Many OpenAI-compatible gateways drop inline `data:image/...` URLs. Register the
 * image on this origin so upstream can fetch `https://your-app/.../vision-staging/id`.
 *
 * On serverless with multiple instances, GET may miss the POST — then callers
 * should fall back to the original data URL (handled in parseVisionPage).
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

"use client";

import { useEffect } from "react";

const RELOAD_KEY = "d2q-chunk-reload";
const RELOAD_COUNT_KEY = "d2q-chunk-reload-count";
const MAX_RELOADS = 2;
/** Let webpack finish writing large dev chunks on Windows before retrying. */
const RELOAD_DELAY_MS = 3000;

function isChunkLoadFailure(reason: unknown): boolean {
  const message =
    reason instanceof Error
      ? reason.message
      : typeof reason === "string"
        ? reason
        : "";
  return /ChunkLoadError|Failed to load chunk|Loading chunk [\w-]+ failed/i.test(
    message,
  );
}

function reloadOnceForChunkError(reason: unknown): void {
  if (!isChunkLoadFailure(reason)) {
    return;
  }

  const reloadCount = Number(sessionStorage.getItem(RELOAD_COUNT_KEY) ?? "0");
  if (reloadCount >= MAX_RELOADS) {
    return;
  }

  if (sessionStorage.getItem(RELOAD_KEY) === "pending") {
    return;
  }

  sessionStorage.setItem(RELOAD_KEY, "pending");
  sessionStorage.setItem(RELOAD_COUNT_KEY, String(reloadCount + 1));

  window.setTimeout(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("_cb", String(Date.now()));
    window.location.replace(url.toString());
  }, RELOAD_DELAY_MS);
}

/**
 * Recover from stale webpack chunks after dev server restart or first compile.
 */
export function ChunkLoadRecovery() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      reloadOnceForChunkError(event.error ?? event.message);
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      reloadOnceForChunkError(event.reason);
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    const clearReloadFlags = () => {
      sessionStorage.removeItem(RELOAD_KEY);
      sessionStorage.removeItem(RELOAD_COUNT_KEY);
      const url = new URL(window.location.href);
      if (url.searchParams.has("_cb")) {
        url.searchParams.delete("_cb");
        window.history.replaceState({}, "", url.toString());
      }
    };
    window.addEventListener("load", clearReloadFlags);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("load", clearReloadFlags);
    };
  }, []);

  return null;
}

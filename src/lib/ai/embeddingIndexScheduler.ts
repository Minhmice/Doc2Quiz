/**
 * Phase 34 — debounced, single-flight scheduling for full-document embedding index builds.
 * Does not read API keys; the UI registers a runner that calls `runEmbeddingIndexJob`.
 */

import { pipelineLog } from "@/lib/logging/pipelineLogger";

/** Default debounce after `putDocument` / extract persist (ms). */
export const EMBEDDING_INDEX_SCHEDULE_DEBOUNCE_MS = 500;

export type EmbeddingIndexUiStatus = {
  status: "idle" | "running" | "done" | "error";
  current?: number;
  total?: number;
  lastError?: string | null;
};

export type EmbeddingIndexRunnerContext = {
  studySetId: string;
  signal: AbortSignal;
};

export type EmbeddingIndexRunner = (
  ctx: EmbeddingIndexRunnerContext,
) => Promise<void>;

const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
const inFlightControllers = new Map<string, AbortController>();
const statusSubscribers = new Map<
  string,
  Set<(s: EmbeddingIndexUiStatus) => void>
>();

let registeredRunner: EmbeddingIndexRunner | null = null;

function emitStatus(studySetId: string, next: EmbeddingIndexUiStatus): void {
  const set = statusSubscribers.get(studySetId);
  if (!set) {
    return;
  }
  for (const fn of set) {
    try {
      fn(next);
    } catch {
      /* listener errors ignored */
    }
  }
}

/** Called by the registered runner to push progress and terminal state. */
export function emitEmbeddingIndexStatus(
  studySetId: string,
  next: EmbeddingIndexUiStatus,
): void {
  emitStatus(studySetId, next);
}

function clearDebounce(studySetId: string): void {
  const t = debounceTimers.get(studySetId);
  if (t !== undefined) {
    clearTimeout(t);
    debounceTimers.delete(studySetId);
  }
}

/**
 * Register the embedding index runner (typically from `AiParseSection`).
 * Only one runner is active — latest registration wins.
 */
export function registerEmbeddingIndexRunner(runner: EmbeddingIndexRunner | null): void {
  registeredRunner = runner;
}

/**
 * Subscribe to indexing UI status for one study set. Returns unsubscribe.
 */
export function subscribeEmbeddingIndexStatus(
  studySetId: string,
  onChange: (s: EmbeddingIndexUiStatus) => void,
): () => void {
  let set = statusSubscribers.get(studySetId);
  if (!set) {
    set = new Set();
    statusSubscribers.set(studySetId, set);
  }
  set.add(onChange);
  return () => {
    const s = statusSubscribers.get(studySetId);
    if (!s) {
      return;
    }
    s.delete(onChange);
    if (s.size === 0) {
      statusSubscribers.delete(studySetId);
    }
  };
}

function abortInFlight(studySetId: string): void {
  const prev = inFlightControllers.get(studySetId);
  if (prev) {
    prev.abort();
    inFlightControllers.delete(studySetId);
  }
}

async function runRegisteredJob(studySetId: string, signal: AbortSignal): Promise<void> {
  const runner = registeredRunner;
  if (!runner) {
    pipelineLog("PARSE", "embedding-rank", "info", "embedding_index_schedule", {
      studySetId,
      skipped: "no_runner",
    });
    return;
  }
  try {
    await runner({ studySetId, signal });
  } catch (e) {
    if (signal.aborted || (e instanceof DOMException && e.name === "AbortError")) {
      emitStatus(studySetId, {
        status: "idle",
        lastError: "Cancelled",
      });
      return;
    }
    const msg = e instanceof Error ? e.message : String(e);
    emitStatus(studySetId, {
      status: "error",
      lastError: msg,
    });
  } finally {
    const cur = inFlightControllers.get(studySetId);
    if (cur?.signal === signal) {
      inFlightControllers.delete(studySetId);
    }
  }
}

async function startJobNow(studySetId: string): Promise<void> {
  pipelineLog("PARSE", "embedding-rank", "info", "embedding_index_debounced", {
    studySetId,
  });
  abortInFlight(studySetId);
  const controller = new AbortController();
  inFlightControllers.set(studySetId, controller);
  await runRegisteredJob(studySetId, controller.signal);
}

/**
 * Called after extracted text is persisted (`putDocument` success). Debounced; coalesces rapid saves.
 */
export function scheduleEmbeddingIndexAfterExtract(studySetId: string): void {
  if (!studySetId.trim()) {
    return;
  }
  pipelineLog("PARSE", "embedding-rank", "info", "embedding_index_schedule", {
    studySetId,
  });
  clearDebounce(studySetId);
  const t = setTimeout(() => {
    debounceTimers.delete(studySetId);
    void startJobNow(studySetId);
  }, EMBEDDING_INDEX_SCHEDULE_DEBOUNCE_MS);
  debounceTimers.set(studySetId, t);
}

/**
 * Run indexing immediately (manual “Build embedding index”), same runner path as auto-index.
 */
export function triggerEmbeddingIndexManual(studySetId: string): void {
  if (!studySetId.trim()) {
    return;
  }
  clearDebounce(studySetId);
  abortInFlight(studySetId);
  void startJobNow(studySetId);
}

/**
 * Cancel debounced pending run and abort in-flight job for this study set.
 */
export function cancelEmbeddingIndexForStudySet(studySetId: string): void {
  clearDebounce(studySetId);
  abortInFlight(studySetId);
  emitStatus(studySetId, { status: "idle", lastError: null });
}

/**
 * Phase 36 — client-side queue for optional second-pass “high accuracy” parse when
 * uncertainty signals fire. V1: registry + logging; full second-pass runner is wired later.
 */

import { pipelineLog } from "@/lib/logging/pipelineLogger";

export type UncertaintySignal = {
  code: string;
  /** Higher = more likely to enqueue refinement (planner-tuned thresholds later). */
  weight?: number;
};

export type UncertainFallbackContext = {
  studySetId: string;
  signal: AbortSignal;
  signals: UncertaintySignal[];
};

export type UncertainFallbackRunner = (
  ctx: UncertainFallbackContext,
) => Promise<void>;

let runner: UncertainFallbackRunner | null = null;

const inFlight = new Map<string, AbortController>();

export function registerUncertainFallbackRunner(r: UncertainFallbackRunner | null): void {
  runner = r;
}

/**
 * Record uncertainty for observability. When a runner is registered, may start a
 * debounced second pass (future); v1 logs only unless runner performs work.
 */
export function reportUncertainParseSignals(
  studySetId: string,
  signals: UncertaintySignal[],
): void {
  if (!studySetId.trim() || signals.length === 0) {
    return;
  }
  pipelineLog("PARSE", "uncertain-fallback", "info", "uncertain_parse_signals", {
    studySetId,
    codes: signals.map((s) => s.code),
  });
  const r = runner;
  if (!r) {
    return;
  }
  abortInFlight(studySetId);
  const controller = new AbortController();
  inFlight.set(studySetId, controller);
  void r({ studySetId, signal: controller.signal, signals }).finally(() => {
    const cur = inFlight.get(studySetId);
    if (cur === controller) {
      inFlight.delete(studySetId);
    }
  });
}

export function cancelUncertainFallbackForStudySet(studySetId: string): void {
  abortInFlight(studySetId);
}

function abortInFlight(studySetId: string): void {
  const prev = inFlight.get(studySetId);
  if (prev) {
    prev.abort();
    inFlight.delete(studySetId);
  }
}

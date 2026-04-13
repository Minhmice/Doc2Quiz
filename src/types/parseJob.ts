/**
 * Parse job queue types — Phase 15 roadmap (server / worker scale mode).
 * Shared by App Router API routes and future client hooks.
 */

export type ParseJobStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

export type ParseJobSummary = {
  id: string;
  status: ParseJobStatus;
  updatedAt: string;
  progress?: { done: number; total: number };
};

export type ParseJobCreateResponse = {
  job: ParseJobSummary;
};

import type { User } from "@supabase/supabase-js";

import { resolveUserAiTier } from "@/lib/server/resolveUserAiTier";

import { QuotaExceededError } from "./QuotaExceededError";

type QuotaRpcSupabase = {
  rpc: (
    functionName: string,
    args: Record<string, string>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

export class GenerationInProgressError extends Error {
  constructor(readonly reservationExpiresAt: string) {
    super("Generation already in progress for this study set.");
    this.name = "GenerationInProgressError";
  }
}

export type ReserveGenerationQuotaResult =
  | {
      kind: "reserved";
      reservationToken: string;
      usedBonus: boolean;
      reservationExpiresAt: string;
    }
  | { kind: "already_committed"; usedBonus: boolean };

export type GenerationQuotaAvailability = {
  status: "available" | "quota_exceeded" | "already_committed" | "generation_in_progress";
  canGenerate: boolean;
  weeklyUsed: number;
  weeklyLimit: number;
  bonusCredits: number;
  weekResetsAt: string;
  reservationExpiresAt?: string;
};

type CommitGenerationQuotaResult = {
  status: "committed" | "reservation_not_found" | "reserved" | "released";
  usedBonus?: boolean;
};

type ReleaseGenerationQuotaResult = {
  status: "released" | "already_released" | "already_committed";
  usedBonus?: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" ? value : null;
}

function readNumber(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readBoolean(record: Record<string, unknown>, key: string): boolean | null {
  const value = record[key];
  return typeof value === "boolean" ? value : null;
}

function parseReserveResult(data: unknown): ReserveGenerationQuotaResult {
  if (!isRecord(data)) {
    throw new Error("invalid reserve_generation_quota response");
  }

  const status = readString(data, "status");
  if (status === "reserved") {
    const reservationToken = readString(data, "reservationToken");
    const usedBonus = readBoolean(data, "usedBonus");
    const reservationExpiresAt = readString(data, "reservationExpiresAt");
    if (!reservationToken || usedBonus === null || !reservationExpiresAt) {
      throw new Error("invalid reserve_generation_quota response");
    }
    return { kind: "reserved", reservationToken, usedBonus, reservationExpiresAt };
  }

  if (status === "already_committed") {
    const usedBonus = readBoolean(data, "usedBonus");
    if (usedBonus === null) {
      throw new Error("invalid reserve_generation_quota response");
    }
    return { kind: "already_committed", usedBonus };
  }

  if (status === "generation_in_progress") {
    const reservationExpiresAt = readString(data, "reservationExpiresAt");
    if (!reservationExpiresAt) {
      throw new Error("invalid reserve_generation_quota response");
    }
    throw new GenerationInProgressError(reservationExpiresAt);
  }

  if (status === "quota_exceeded") {
    const weeklyUsed = readNumber(data, "weeklyUsed");
    const weeklyLimit = readNumber(data, "weeklyLimit");
    const bonusCredits = readNumber(data, "bonusCredits");
    const weekResetsAt = readString(data, "weekResetsAt");
    if (weeklyUsed === null || weeklyLimit === null || bonusCredits === null || !weekResetsAt) {
      throw new Error("invalid reserve_generation_quota response");
    }
    throw new QuotaExceededError({ weeklyUsed, weeklyLimit, bonusCredits, weekResetsAt });
  }

  throw new Error("invalid reserve_generation_quota response");
}

function parseAvailabilityCounters(data: Record<string, unknown>) {
  const weeklyUsed = readNumber(data, "weeklyUsed");
  const weeklyLimit = readNumber(data, "weeklyLimit");
  const bonusCredits = readNumber(data, "bonusCredits");
  const weekResetsAt = readString(data, "weekResetsAt");
  if (weeklyUsed === null || weeklyLimit === null || bonusCredits === null || !weekResetsAt) {
    return null;
  }
  return { weeklyUsed, weeklyLimit, bonusCredits, weekResetsAt };
}

export function parseGenerationQuotaAvailability(data: unknown): GenerationQuotaAvailability {
  if (!isRecord(data)) {
    throw new Error("invalid get_generation_quota_availability response");
  }

  const status = readString(data, "status");
  if (status === "already_committed") {
    const canGenerate = readBoolean(data, "canGenerate");
    if (canGenerate !== true) {
      throw new Error("invalid get_generation_quota_availability response");
    }
    const counters = parseAvailabilityCounters(data);
    return {
      status,
      canGenerate: true,
      weeklyUsed: counters?.weeklyUsed ?? 0,
      weeklyLimit: counters?.weeklyLimit ?? 10,
      bonusCredits: counters?.bonusCredits ?? 0,
      weekResetsAt: counters?.weekResetsAt ?? new Date(0).toISOString(),
    };
  }

  if (status === "generation_in_progress") {
    const canGenerate = readBoolean(data, "canGenerate");
    const reservationExpiresAt = readString(data, "reservationExpiresAt");
    if (canGenerate !== false || !reservationExpiresAt) {
      throw new Error("invalid get_generation_quota_availability response");
    }
    const counters = parseAvailabilityCounters(data);
    return {
      status,
      canGenerate: false,
      weeklyUsed: counters?.weeklyUsed ?? 0,
      weeklyLimit: counters?.weeklyLimit ?? 10,
      bonusCredits: counters?.bonusCredits ?? 0,
      weekResetsAt: counters?.weekResetsAt ?? new Date(0).toISOString(),
      reservationExpiresAt,
    };
  }

  if (status === "available" || status === "quota_exceeded") {
    const canGenerate = readBoolean(data, "canGenerate");
    const counters = parseAvailabilityCounters(data);
    if (canGenerate === null || !counters) {
      throw new Error("invalid get_generation_quota_availability response");
    }
    return { status, canGenerate, ...counters };
  }

  throw new Error("invalid get_generation_quota_availability response");
}

function parseCommitResult(data: unknown): CommitGenerationQuotaResult {
  if (!isRecord(data)) {
    throw new Error("invalid commit_generation_quota response");
  }
  const status = readString(data, "status");
  if (
    status !== "committed" &&
    status !== "reservation_not_found" &&
    status !== "reserved" &&
    status !== "released"
  ) {
    throw new Error("invalid commit_generation_quota response");
  }
  const usedBonus = readBoolean(data, "usedBonus");
  return usedBonus === null ? { status } : { status, usedBonus };
}

function parseReleaseResult(data: unknown): ReleaseGenerationQuotaResult {
  if (!isRecord(data)) {
    throw new Error("invalid release_generation_quota response");
  }
  const status = readString(data, "status");
  if (status !== "released" && status !== "already_released" && status !== "already_committed") {
    throw new Error("invalid release_generation_quota response");
  }
  const usedBonus = readBoolean(data, "usedBonus");
  return usedBonus === null ? { status } : { status, usedBonus };
}

export async function reserveGenerationQuota({
  supabase,
  user,
  studySetId,
  contentKind,
}: {
  supabase: QuotaRpcSupabase;
  user: User;
  studySetId: string;
  contentKind: "quiz" | "flashcards";
}): Promise<ReserveGenerationQuotaResult> {
  if (resolveUserAiTier(user) === "pro") {
    return { kind: "already_committed", usedBonus: false };
  }

  const { data, error } = await supabase.rpc("reserve_generation_quota", {
    p_study_set_id: studySetId,
    p_content_kind: contentKind,
  });
  if (error) throw new Error(error.message);
  return parseReserveResult(data);
}

export async function commitGenerationQuota({
  supabase,
  reservationToken,
}: {
  supabase: QuotaRpcSupabase;
  reservationToken: string;
}): Promise<CommitGenerationQuotaResult> {
  const { data, error } = await supabase.rpc("commit_generation_quota", {
    p_reservation_token: reservationToken,
  });
  if (error) throw new Error(error.message);
  return parseCommitResult(data);
}

export async function releaseGenerationQuota({
  supabase,
  reservationToken,
}: {
  supabase: QuotaRpcSupabase;
  reservationToken: string;
}): Promise<ReleaseGenerationQuotaResult> {
  const { data, error } = await supabase.rpc("release_generation_quota", {
    p_reservation_token: reservationToken,
  });
  if (error) throw new Error(error.message);
  return parseReleaseResult(data);
}

export async function getGenerationQuotaAvailability({
  supabase,
  studySetId,
}: {
  supabase: QuotaRpcSupabase;
  studySetId: string;
}): Promise<GenerationQuotaAvailability> {
  const { data, error } = await supabase.rpc("get_generation_quota_availability", {
    p_study_set_id: studySetId,
  });
  if (error) throw new Error(error.message);
  return parseGenerationQuotaAvailability(data);
}

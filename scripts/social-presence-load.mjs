#!/usr/bin/env node
import process from "node:process";

const scenarios = [
  { id: "healthy-100", concurrency: 100, rampPerSecond: 10, durationSeconds: 120 },
  { id: "healthy-1000", concurrency: 1000, rampPerSecond: 10, durationSeconds: 120 },
  { id: "outage-recovery", concurrency: 100, rampPerSecond: 10, durationSeconds: 120 },
];

export const evidenceSchema = {
  required: ["runId", "scenario", "thresholds", "redaction", "caveats"],
  thresholds: {
    heartbeatSuccessRate: ">=99%",
    heartbeatP95Ms: "<=500",
    heartbeatP99Ms: "<=1000",
    snapshotP95Ms: "<=750",
    snapshotP99Ms: "<=1500",
    queueOldestSeconds: "<=30",
    postgresHeartbeatWrites: "=0",
  },
  scenarios,
};

function isSafeTarget(value) {
  try {
    const url = new URL(value);
    if (url.username || url.password) return false;
    const host = url.hostname.toLowerCase();
    return !/(prod|production|shared)/.test(host) && (host === "localhost" || host === "127.0.0.1" || process.env.PHASE15_ALLOW_DISPOSABLE_TEST_HOST === host);
  } catch {
    return false;
  }
}

export function validateConfig(env = {}) {
  if (env.PHASE15_TEST_CONFIRM !== "YES" || env.PHASE15_REDIS_TEST_CONFIRM !== "YES") return "Explicit disposable confirmations required.";
  if (!isSafeTarget(env.PHASE15_TEST_REDIS_URL ?? "") || !isSafeTarget(env.PHASE15_TEST_DATABASE_URL ?? "")) return "Approved disposable Redis and SQL targets required.";
  return null;
}

function main(argv) {
  if (argv.includes("--help")) {
    console.log("Usage: node scripts/social-presence-load.mjs --check-schema");
    return 0;
  }
  if (argv.includes("--check-schema")) {
    console.log(JSON.stringify(evidenceSchema));
    return 0;
  }
  const issue = validateConfig();
  if (issue) throw new Error(issue);
  throw new Error("External load execution belongs to approved Phase 15 evidence run.");
}

if (process.argv[1]?.endsWith("social-presence-load.mjs")) {
  try { process.exitCode = main(process.argv.slice(2)); } catch (error) { console.error(error instanceof Error ? error.message : "Invalid load configuration."); process.exitCode = 1; }
}

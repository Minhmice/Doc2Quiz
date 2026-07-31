import { readFile } from "node:fs/promises";
import { isIP } from "node:net";
import process from "node:process";

const migrationFlag = process.argv.indexOf("--migration");
if (migrationFlag < 0 || !process.argv[migrationFlag + 1]) {
  console.error("Usage: node scripts/verify-phase12-study-together-sql.mjs --migration <path>");
  process.exit(1);
}

const migrationPath = process.argv[migrationFlag + 1];
const sql = await readFile(migrationPath, "utf8");
const required = [
  "create_study_challenge", "start_study_challenge_attempt", "accept_study_challenge",
  "complete_study_attempt", "study_together_sessions", "study_together_attempts",
  "social_notifications", "social_reactions", "realtime.send", "social-notifications:",
  "sweep_study_challenge_reminders", "learning_outputs", "approved_questions",
  "correct_index", "security definer", "for update", "grant execute",
];
const missing = required.filter((token) => !sql.toLowerCase().includes(token.toLowerCase()));
const forbidden = ["cron.schedule", "source_type = 'friend_shared_quiz'"];
const presentForbidden = forbidden.filter((token) => sql.toLowerCase().includes(token.toLowerCase()));
if (missing.length || presentForbidden.length) {
  console.error(`STATIC_SQL_PROOF_FAILED: missing=[${missing.join(", ")}] forbidden=[${presentForbidden.join(", ")}]`);
  process.exit(1);
}
console.log(`STATIC_SQL_PROOF_OK: ${migrationPath}`);

const rawUrl = process.env.PHASE12_TEST_DATABASE_URL;
if (!rawUrl) {
  console.error("SQL_PROOF_BLOCKED: PHASE12_TEST_DATABASE_URL is not set; static contract passed, runtime SQL/RLS proof not run");
  process.exit(2);
}

let url;
try { url = new URL(rawUrl); } catch { console.error("SQL_PROOF_BLOCKED: PHASE12_TEST_DATABASE_URL is invalid"); process.exit(2); }
const host = url.hostname.toLowerCase();
const explicitlyDisposable = process.env.PHASE12_ALLOW_DISPOSABLE_TEST_HOST?.toLowerCase() === host && process.env.PHASE12_DISPOSABLE_TEST_CONFIRM === "YES";
const local = host === "localhost" || host === "127.0.0.1" || host === "::1" || (isIP(host) === 4 && host.startsWith("127."));
if (!local && !explicitlyDisposable) {
  console.error(`SQL_PROOF_BLOCKED: unsafe database host ${host}; use local Supabase or set matching PHASE12_ALLOW_DISPOSABLE_TEST_HOST plus PHASE12_DISPOSABLE_TEST_CONFIRM=YES`);
  process.exit(2);
}

console.error("SQL_PROOF_BLOCKED: runtime driver unavailable by design; run migration and fixtures through repository local Supabase tooling when configured");
process.exit(2);

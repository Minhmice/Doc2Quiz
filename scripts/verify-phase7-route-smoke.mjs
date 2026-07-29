import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";

const port = 4317;
const baseUrl = `http://127.0.0.1:${port}`;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_SUPABASESERVICE_KEY)?.trim();
if (!supabaseUrl || !anonKey || !serviceKey) {
  throw new Error("Route smoke requires NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY runtime credentials.");
}
if (process.env.D2Q_ROUTE_SMOKE_SECRET || fs.readFileSync("package.json", "utf8").includes("D2Q_ROUTE_SMOKE_SECRET")) {
  throw new Error("D2Q_ROUTE_SMOKE_SECRET must not be committed or configured.");
}

const api = `${supabaseUrl.replace(/\/$/, "")}/rest/v1`;
const auth = `${supabaseUrl.replace(/\/$/, "")}/auth/v1`;
const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" };
const userEmail = `phase7-smoke-${randomUUID()}@example.test`;
const userPassword = `P7-${randomUUID()}-aZ9!`;
let userId;
let quizSetId;
let flashcardSetId;
let server;

async function supabase(path, options = {}) {
  const response = await fetch(`${api}${path}`, { ...options, headers: { ...headers, ...options.headers } });
  if (!response.ok) throw new Error(`Supabase ${options.method || "GET"} ${path}: ${response.status} ${await response.text()}`);
  return response.status === 204 ? null : response.json();
}
async function assert(condition, message) { if (!condition) throw new Error(message); }
async function fetchRoute(path, cookie) {
  return fetch(`${baseUrl}${path}`, { redirect: "manual", headers: cookie ? { cookie } : {} });
}
async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { const response = await fetchRoute("/login"); if (response.status < 500) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Production server did not become ready on port 4317.");
}
async function createFixture() {
  const created = await fetch(`${auth}/admin/users`, { method: "POST", headers: { ...headers }, body: JSON.stringify({ email: userEmail, password: userPassword, email_confirm: true }) });
  if (!created.ok) throw new Error(`Supabase admin user creation failed: ${created.status} ${await created.text()}`);
  userId = (await created.json()).id;
  const sets = await supabase("/study_sets", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify([{ user_id: userId, title: "Phase 7 route smoke quiz", pipeline_stage: "quiz", content_kind: "quiz" }, { user_id: userId, title: "Phase 7 route smoke flashcard", pipeline_stage: "flashcards", content_kind: "flashcards" }]) });
  quizSetId = sets[0].id;
  flashcardSetId = sets[1].id;
  await supabase("/approved_questions", { method: "POST", body: JSON.stringify([{ user_id: userId, study_set_id: quizSetId, question: "Smoke question", choices: ["A", "B", "C", "D"], correct_index: 0, explanation: "Smoke" }]) });
  await supabase("/approved_flashcards", { method: "POST", body: JSON.stringify([{ user_id: userId, study_set_id: flashcardSetId, front: "Smoke front", back: "Smoke back" }]) });
}
async function signIn() {
  const response = await fetch(`${auth}/token?grant_type=password`, { method: "POST", headers: { apikey: anonKey, "Content-Type": "application/json" }, body: JSON.stringify({ email: userEmail, password: userPassword }) });
  if (!response.ok) throw new Error(`Supabase password sign-in failed: ${response.status} ${await response.text()}`);
  const body = await response.json();
  return `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token=${encodeURIComponent(JSON.stringify({ access_token: body.access_token, refresh_token: body.refresh_token, expires_at: Math.floor(Date.now() / 1000) + body.expires_in, expires_in: body.expires_in, token_type: "bearer" }))}`;
}
async function assertProtected(path, cookie) {
  const response = await fetchRoute(path, cookie);
  await assert(response.status >= 200 && response.status < 300, `${path} returned ${response.status}, expected authenticated non-3xx response`);
  await assert(!response.headers.has("location"), `${path} unexpectedly returned Location`);
}
async function assertGone(path) {
  const response = await fetchRoute(path);
  await assert(response.status === 404, `${path} returned ${response.status}, expected exact 404`);
  await assert(!response.headers.has("location"), `${path} returned a Location header`);
}
try {
  await createFixture();
  server = spawn("npm", ["start", "--", "-p", String(port)], { shell: true, stdio: "inherit", env: { ...process.env, D2Q_ROUTE_SMOKE_AUTH: undefined, D2Q_ROUTE_SMOKE_SECRET: undefined } });
  await waitForServer();
  const unauth = await fetchRoute(`/quiz/${quizSetId}`);
  await assert(unauth.status >= 300 && unauth.status < 400, `Unauthenticated protected route returned ${unauth.status}; expected fail-closed redirect`);
  const cookie = await signIn();
  await assertProtected(`/dashboard`, cookie);
  await assertProtected(`/quiz/${quizSetId}`, cookie);
  await assertProtected(`/quiz/${quizSetId}/review`, cookie);
  await assertProtected(`/quiz/${quizSetId}/edit`, cookie);
  await assertProtected(`/quiz/${quizSetId}/play`, cookie);
  await assertProtected(`/flashcard/${flashcardSetId}`, cookie);
  await assertProtected(`/flashcard/${flashcardSetId}/review`, cookie);
  await assertProtected(`/flashcard/${flashcardSetId}/edit`, cookie);
  await assertProtected(`/flashcard/${flashcardSetId}/play`, cookie);
  for (const path of [`/edit/new`, `/edit/new/quiz`, `/edit/quiz/${quizSetId}`, `/sets/${quizSetId}/source`, `/flashcards/${flashcardSetId}`, `/quiz/${quizSetId}/done`, `/quiz/${quizSetId}?review=mistakes`]) await assertGone(path);
  const flagOnly = await fetchRoute(`/quiz/${quizSetId}`, undefined);
  await assert(flagOnly.status >= 300 && flagOnly.status < 400, "Smoke flag/header combinations must not authenticate");
  console.log("Phase 7 route smoke passed: canonical authenticated routes and exact legacy 404s.");
} finally {
  if (server) server.kill();
  if (userId) {
    try { await supabase(`/study_sets?user_id=eq.${userId}`, { method: "DELETE" }); } catch (error) { console.error(error.message); }
    try { const response = await fetch(`${auth}/admin/users/${userId}`, { method: "DELETE", headers }); if (!response.ok) console.error(`Supabase cleanup failed: ${response.status}`); } catch (error) { console.error(error.message); }
  }
}

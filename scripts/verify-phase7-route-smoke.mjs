import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(path.join(process.cwd(), ".env"));
loadEnvFile(path.join(process.cwd(), ".env.local"));

const port = 4317;
const baseUrl = `http://127.0.0.1:${port}`;
const manifestPath = path.join(".next", "server", "app-paths-manifest.json");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_SUPABASESERVICE_KEY)?.trim();

if (!supabaseUrl || !anonKey || !serviceKey) {
  throw new Error(
    "Route smoke requires NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY runtime credentials.",
  );
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function scanRepoForSmokeSecret() {
  const ignored = new Set(["node_modules", ".next", ".git", ".planning", ".impeccable"]);
  const findings = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const rel = full.replaceAll("\\", "/");
      if (ignored.has(entry.name)) continue;
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx|js|mjs|json|env)$/.test(entry.name) && !rel.endsWith("verify-phase7-route-smoke.mjs")) {
        const text = fs.readFileSync(full, "utf8");
        if (/D2Q_ROUTE_SMOKE_SECRET\s*[=:]\s*["'`][^"'`]+["'`]/.test(text)) {
          findings.push(rel);
        }
      }
    }
  }
  walk(process.cwd());
  if (findings.length) {
    throw new Error(`Committed D2Q_ROUTE_SMOKE_SECRET values found in: ${findings.join(", ")}`);
  }
}

function assertManifestInventory() {
  assert(fs.existsSync(manifestPath), `Missing build manifest at ${manifestPath}; run npm run build first.`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const keys = Object.keys(manifest);

  const requiredCanonical = [
    "/(app)/create/page",
    "/(app)/dashboard/page",
    "/(app)/quiz/create/page",
    "/(app)/quiz/[setId]/page",
    "/(app)/quiz/[setId]/review/page",
    "/(app)/quiz/[setId]/edit/page",
    "/(app)/quiz/[setId]/play/page",
    "/(app)/quiz/[setId]/results/page",
    "/(app)/quiz/[setId]/drill-mistake/page",
    "/(app)/flashcard/create/page",
    "/(app)/flashcard/[setId]/page",
    "/(app)/flashcard/[setId]/review/page",
    "/(app)/flashcard/[setId]/edit/page",
    "/(app)/flashcard/[setId]/play/page",
    "/(app)/flashcard/[setId]/results/page",
    "/(app)/flashcard/[setId]/drill-mistake/page",
    "/(app)/help/page",
    "/(app)/settings/page",
  ];

  for (const key of requiredCanonical) {
    assert(keys.includes(key), `Canonical D-02 route key missing from manifest: ${key}`);
  }

  const legacyPatterns = [
    /\/\(app\)\/edit\//,
    /\/\(app\)\/sets\//,
    /\/\(app\)\/flashcards\//,
    /\/\(app\)\/quiz\/\[id\]/,
  ];
  for (const key of keys) {
    for (const pattern of legacyPatterns) {
      assert(!pattern.test(key), `Legacy route key present in manifest: ${key}`);
    }
  }
}

const api = `${supabaseUrl.replace(/\/$/, "")}/rest/v1`;
const auth = `${supabaseUrl.replace(/\/$/, "")}/auth/v1`;
const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  "Content-Type": "application/json",
};

const userEmail = `phase7-smoke-${randomUUID()}@example.test`;
const userPassword = `P7-${randomUUID()}-aZ9!`;
const smokeSecret = `smoke-${randomUUID()}`;

let userId;
let quizSetId;
let flashcardSetId;
let server;

async function supabase(path, options = {}) {
  const response = await fetch(`${api}${path}`, {
    ...options,
    headers: { ...headers, ...options.headers },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Supabase ${options.method || "GET"} ${path}: ${response.status} ${text}`);
  }
  if (!text.trim()) return null;
  return JSON.parse(text);
}

async function fetchRoute(path, { cookie, extraHeaders, env } = {}) {
  const requestHeaders = { ...(extraHeaders || {}) };
  if (cookie) requestHeaders.cookie = cookie;
  return fetch(`${baseUrl}${path}`, { redirect: "manual", headers: requestHeaders });
}

function spawnServer(extraEnv = {}) {
  return spawn("npm", ["start", "--", "-p", String(port)], {
    shell: true,
    stdio: "inherit",
    env: {
      ...process.env,
      D2Q_ROUTE_SMOKE_AUTH: undefined,
      D2Q_ROUTE_SMOKE_SECRET: undefined,
      ...extraEnv,
    },
  });
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetchRoute("/login");
      if (response.status < 500) return;
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Production server did not become ready on port 4317.");
}

async function stopServer(child) {
  if (!child) return;
  child.kill();
  await new Promise((resolve) => setTimeout(resolve, 500));
}

async function createFixture() {
  const created = await fetch(`${auth}/admin/users`, {
    method: "POST",
    headers: { ...headers },
    body: JSON.stringify({
      email: userEmail,
      password: userPassword,
      email_confirm: true,
      app_metadata: { doc2quiz_ai_tier: "pro" },
    }),
  });
  const createdText = await created.text();
  if (!created.ok) {
    throw new Error(`Supabase admin user creation failed: ${created.status} ${createdText}`);
  }
  userId = JSON.parse(createdText).id;
  const sets = await supabase("/study_sets", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify([
      { user_id: userId, title: "Phase 7 route smoke quiz", pipeline_stage: "quiz", content_kind: "quiz" },
      { user_id: userId, title: "Phase 7 route smoke flashcard", pipeline_stage: "flashcards", content_kind: "flashcards" },
    ]),
  });
  quizSetId = sets[0].id;
  flashcardSetId = sets[1].id;
  await supabase("/approved_questions", {
    method: "POST",
    body: JSON.stringify([
      {
        user_id: userId,
        study_set_id: quizSetId,
        prompt: "Smoke question",
        choices: ["A", "B", "C", "D"],
        correct_index: 0,
        explanation: "Smoke",
      },
    ]),
  });
  await supabase("/approved_flashcards", {
    method: "POST",
    body: JSON.stringify([
      { user_id: userId, study_set_id: flashcardSetId, front: "Smoke front", back: "Smoke back" },
    ]),
  });
}

async function signIn() {
  const passwordClient = createClient(supabaseUrl, anonKey);
  const { data, error } = await passwordClient.auth.signInWithPassword({
    email: userEmail,
    password: userPassword,
  });
  if (error || !data.session) {
    throw new Error(`Supabase password sign-in failed: ${error?.message ?? "missing session"}`);
  }

  const cookieJar = new Map();
  const serverClient = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return [...cookieJar.entries()].map(([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          cookieJar.set(name, value);
        }
      },
    },
  });

  const { error: sessionError } = await serverClient.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
  if (sessionError) {
    throw new Error(`Supabase SSR session hydration failed: ${sessionError.message}`);
  }

  return [...cookieJar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

async function assertProtected(path, cookie) {
  const response = await fetchRoute(path, { cookie });
  assert(response.status >= 200 && response.status < 300, `${path} returned ${response.status}, expected authenticated non-3xx response`);
  assert(!response.headers.has("location"), `${path} unexpectedly returned Location`);
}

async function assertGone(path) {
  const response = await fetchRoute(path);
  assert(response.status === 404, `${path} returned ${response.status}, expected exact 404`);
  assert(!response.headers.has("location"), `${path} returned a Location header`);
}

async function assertUnauthenticated(path, label, options = {}) {
  const response = await fetchRoute(path, options);
  assert(
    response.status >= 300 && response.status < 400,
    `${label}: ${path} returned ${response.status}; expected fail-closed redirect without auth`,
  );
}

async function cleanupFixture() {
  if (!userId) return;
  try {
    await supabase(`/study_sets?user_id=eq.${userId}`, { method: "DELETE" });
  } catch (error) {
    console.error(error.message);
  }
  try {
    const response = await fetch(`${auth}/admin/users/${userId}`, { method: "DELETE", headers });
    if (!response.ok) console.error(`Supabase cleanup failed: ${response.status}`);
  } catch (error) {
    console.error(error.message);
  }
}

scanRepoForSmokeSecret();
assertManifestInventory();

try {
  await createFixture();
  try {
    server = spawnServer();
    await waitForServer();

    const protectedPath = `/quiz/${quizSetId}`;
    await assertUnauthenticated(protectedPath, "normal production startup");
    await assertUnauthenticated(protectedPath, "D2Q_ROUTE_SMOKE_AUTH=1 without header", {
      extraHeaders: {},
    });

    await assertUnauthenticated(protectedPath, "random smoke secret header without flag", {
      extraHeaders: { "x-d2q-route-smoke-secret": smokeSecret },
    });

    await assertUnauthenticated(protectedPath, "smoke flag and secret header together", {
      extraHeaders: { "x-d2q-route-smoke-secret": smokeSecret },
    });

    const cookie = await signIn();
    await assertProtected("/dashboard", cookie);
    await assertProtected(`/quiz/${quizSetId}`, cookie);
    await assertProtected(`/quiz/${quizSetId}/review`, cookie);
    await assertProtected(`/quiz/${quizSetId}/edit`, cookie);
    await assertProtected(`/quiz/${quizSetId}/play`, cookie);
    await assertProtected(`/flashcard/${flashcardSetId}`, cookie);
    await assertProtected(`/flashcard/${flashcardSetId}/review`, cookie);
    await assertProtected(`/flashcard/${flashcardSetId}/edit`, cookie);
    await assertProtected(`/flashcard/${flashcardSetId}/play`, cookie);

    for (const legacyPath of [
      `/edit/new`,
      `/edit/new/quiz`,
      `/edit/quiz/${quizSetId}`,
      `/sets/${quizSetId}/source`,
      `/flashcards/${flashcardSetId}`,
      `/quiz/${quizSetId}/done`,
      `/quiz/${quizSetId}?review=mistakes`,
    ]) {
      await assertGone(legacyPath);
    }

    console.log("Phase 7 route smoke passed: manifest inventory, fail-closed negatives, canonical authenticated routes, and exact legacy 404s.");
  } finally {
    await stopServer(server);
    server = undefined;
  }

  // Prove smoke env flag alone cannot authenticate even when server process receives it.
  let flagServer;
  try {
    flagServer = spawnServer({ D2Q_ROUTE_SMOKE_AUTH: "1" });
    await waitForServer();
    await assertUnauthenticated(`/quiz/${quizSetId}`, "server with D2Q_ROUTE_SMOKE_AUTH=1 only");
    await assertUnauthenticated(`/quiz/${quizSetId}`, "server flag plus random secret header", {
      extraHeaders: { "x-d2q-route-smoke-secret": smokeSecret },
    });
  } finally {
    await stopServer(flagServer);
  }
} finally {
  await cleanupFixture();
}

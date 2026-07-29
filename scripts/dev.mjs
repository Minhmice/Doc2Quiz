import { spawn } from "node:child_process";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
const devLockPath = path.join(root, ".next", "dev", "lock");

function readDevLock() {
  if (!existsSync(devLockPath)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(devLockPath, "utf8"));
  } catch {
    return null;
  }
}

function isPidRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function warnIfDevServerAlreadyRunning() {
  const lock = readDevLock();
  if (!lock?.pid) {
    return;
  }

  if (isPidRunning(lock.pid)) {
    const url = lock.appUrl ?? "http://localhost:3000";
    console.error(
      `\n⚠ Dev server is already running (PID ${lock.pid}) at ${url}`,
      "\n  → Open that URL in your browser — no need to run npm run dev again.",
      `\n  → To restart: taskkill /PID ${lock.pid} /F`,
      " then npm run dev\n",
    );
    process.exit(0);
  }

  try {
    unlinkSync(devLockPath);
  } catch {
    // Next.js will recreate the lock when dev starts.
  }
}

/** Cursor / Node 25 may inject `--localstorage-file` without a path — strip it. */
function sanitizeNodeOptions(raw) {
  if (!raw) return undefined;
  const cleaned = raw
    .split(/\s+/)
    .filter((flag) => flag && !flag.startsWith("--localstorage-file"))
    .join(" ")
    .trim();
  return cleaned || undefined;
}

function buildEnv() {
  const env = { ...process.env };
  const cleaned = sanitizeNodeOptions(env.NODE_OPTIONS);
  if (cleaned) {
    env.NODE_OPTIONS = cleaned;
  } else {
    // Explicitly unset — prevents broken flags re-applied to Next/webpack worker processes.
    delete env.NODE_OPTIONS;
  }
  return env;
}

warnIfDevServerAlreadyRunning();

const child = spawn(process.execPath, [nextBin, "dev", "--webpack"], {
  stdio: "inherit",
  env: buildEnv(),
  cwd: root,
});

child.on("error", (error) => {
  console.error("[dev] failed to start Next.js:", error.message);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (code !== 0 || signal) {
    console.error(
      `\n[dev] Next.js stopped (code=${code ?? "null"}, signal=${signal ?? "null"}).`,
      "If another dev server is using port 3000, stop it with:",
      "  taskkill /F /IM node.exe",
      "or kill the PID shown in .next/dev/lock\n",
    );
  }
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});

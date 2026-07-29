import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const isWin = process.platform === "win32";
const venvDir = path.join(root, ".venv");
const python = isWin
  ? path.join(venvDir, "Scripts", "python.exe")
  : path.join(venvDir, "bin", "python");
const pip = isWin
  ? path.join(venvDir, "Scripts", "pip.exe")
  : path.join(venvDir, "bin", "pip");
const uv = isWin
  ? path.join(venvDir, "Scripts", "uv.exe")
  : path.join(venvDir, "bin", "uv");
const uvCacheDir = path.join(root, ".uv-cache");
const bootstrapPython =
  process.env.MARKITDOWN_BOOTSTRAP_PYTHON ||
  process.env.PYTHON ||
  (isWin ? "py" : "python3");

function run(cmd, args, label, env = process.env) {
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    cwd: root,
    env,
  });
  if (result.status !== 0) {
    if (result.error) {
      console.error(result.error.message);
    }
    console.error(`setup:python failed during ${label}`);
    if (label === "venv create") {
      console.error(
        "Install Python >=3.10 or set MARKITDOWN_BOOTSTRAP_PYTHON to a real Python executable (Microsoft Store aliases do not work).",
      );
    }
    process.exit(result.status ?? 1);
  }
}

if (!existsSync(python)) {
  console.log("Creating .venv …");
  run(bootstrapPython, ["-m", "venv", ".venv"], "venv create");
}

if (!existsSync(uv)) {
  console.log("Installing uv resolver …");
  run(pip, ["install", "--no-deps", "uv"], "uv install");
}

console.log("Installing Doc2Quiz MarkItDown formats from requirements.txt …");
run(
  uv,
  ["pip", "install", "--python", python, "-r", "requirements.txt"],
  "dependency install",
  { ...process.env, UV_CACHE_DIR: uvCacheDir },
);

const version = spawnSync(python, ["-m", "markitdown", "--version"], {
  cwd: root,
  encoding: "utf8",
});
console.log(version.stdout?.trim() ?? "markitdown installed");
console.log(
  `\nSet in .env:\nMARKITDOWN_PYTHON=${isWin ? ".venv\\\\Scripts\\\\python.exe" : ".venv/bin/python"}`,
);

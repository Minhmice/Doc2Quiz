import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const MARKITDOWN_VERSION = "0.1.6";

const PDF_SETUP_HINT =
  "Install PDF support: python -m venv .venv && .venv\\Scripts\\pip install -r requirements.txt (Windows) " +
  "or source .venv/bin/activate && pip install -r requirements.txt (macOS/Linux). " +
  "Set MARKITDOWN_PYTHON to your venv interpreter.";

function getPythonExecutable(): string {
  if (process.env.MARKITDOWN_PYTHON) {
    return process.env.MARKITDOWN_PYTHON;
  }

  const venvPython =
    process.platform === "win32"
      ? join(process.cwd(), ".venv", "Scripts", "python.exe")
      : join(process.cwd(), ".venv", "bin", "python");

  if (existsSync(venvPython)) {
    return venvPython;
  }

  return "python";
}

function formatMarkItDownError(stderr: string, code: number | null): string {
  const message = stderr.trim();
  if (/No module named ['"]?markitdown/i.test(message)) {
    return `MarkItDown is not installed for the selected Python interpreter. ${PDF_SETUP_HINT}\n\n${message}`;
  }
  if (
    /MissingDependencyException|markitdown\[pdf\]|markitdown\[all\]/i.test(
      message,
    )
  ) {
    return `MarkItDown PDF dependencies are not installed. ${PDF_SETUP_HINT}\n\n${message}`;
  }
  return message || `markitdown exited ${code ?? "unknown"}`;
}

async function runMarkItDownCli(inputPath: string): Promise<string> {
  const outPath = join(tmpdir(), `md-out-${randomUUID()}.md`);
  const python = getPythonExecutable();

  await new Promise<void>((resolve, reject) => {
    const child = spawn(python, ["-m", "markitdown", inputPath, "-o", outPath], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(formatMarkItDownError(stderr, code)));
    });
  });

  try {
    return await readFile(outPath, "utf8");
  } finally {
    await unlink(outPath).catch(() => undefined);
  }
}

export async function convertWithMarkItDown(inputPath: string): Promise<string> {
  return runMarkItDownCli(inputPath);
}

export async function convertPasteWithMarkItDown(text: string): Promise<string> {
  const pastePath = join(tmpdir(), `paste-${randomUUID()}.txt`);
  await writeFile(pastePath, text, "utf8");
  try {
    return await convertWithMarkItDown(pastePath);
  } finally {
    await unlink(pastePath).catch(() => undefined);
  }
}

export async function convertUrlWithMarkItDown(url: string): Promise<string> {
  return runMarkItDownCli(url);
}

import { EventEmitter } from "node:events";
import { readFile, writeFile } from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";

const spawnMock = vi.fn();

vi.mock("node:child_process", () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
}));

vi.mock("node:fs", () => ({
  existsSync: vi.fn(() => false),
}));

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...actual,
    readFile: vi.fn(actual.readFile),
    writeFile: vi.fn(actual.writeFile),
    unlink: vi.fn(async () => undefined),
  };
});

import {
  convertPasteWithMarkItDown,
  convertUrlWithMarkItDown,
  convertWithMarkItDown,
} from "@/lib/pipeline/markitdown";

function mockSpawnSuccess(stdout = "# converted") {
  spawnMock.mockImplementation(() => {
    const child = new EventEmitter() as EventEmitter & {
      stderr: EventEmitter;
      stdout: EventEmitter;
    };
    child.stderr = new EventEmitter();
    child.stdout = new EventEmitter();
    vi.mocked(readFile).mockResolvedValueOnce(stdout);
    queueMicrotask(() => child.emit("close", 0));
    return child;
  });
}

function mockSpawnFailure(stderr = "conversion failed") {
  spawnMock.mockImplementation(() => {
    const child = new EventEmitter() as EventEmitter & {
      stderr: EventEmitter;
      stdout: EventEmitter;
    };
    child.stderr = new EventEmitter();
    child.stdout = new EventEmitter();
    queueMicrotask(() => {
      child.stderr.emit("data", Buffer.from(stderr));
      child.emit("close", 1);
    });
    return child;
  });
}

describe("convertWithMarkItDown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.MARKITDOWN_PYTHON;
  });

  it("spawns python -m markitdown with -o output path", async () => {
    mockSpawnSuccess("# hello");

    const result = await convertWithMarkItDown("/tmp/input.pdf");

    expect(spawnMock).toHaveBeenCalled();
    const [python, args] = spawnMock.mock.calls[0] as [string, string[]];
    expect(python).toBe("python");
    expect(args).toEqual(
      expect.arrayContaining([
        "-m",
        "markitdown",
        "/tmp/input.pdf",
        "-o",
        expect.stringMatching(/\.md$/),
      ]),
    );
    expect(result).toBe("# hello");
  });

  it("uses MARKITDOWN_PYTHON when set", async () => {
    process.env.MARKITDOWN_PYTHON = "/usr/bin/python3";
    mockSpawnSuccess();

    await convertWithMarkItDown("/tmp/input.pdf");

    const [python] = spawnMock.mock.calls[0] as [string, string[]];
    expect(python).toBe("/usr/bin/python3");
  });

  it("throws when markitdown exits non-zero", async () => {
    mockSpawnFailure("bad file");

    await expect(convertWithMarkItDown("/tmp/bad.pdf")).rejects.toThrow(
      /bad file|markitdown exited/i,
    );
  });

  it("adds setup guidance when the selected Python lacks markitdown", async () => {
    mockSpawnFailure("python.exe: No module named markitdown");

    await expect(convertWithMarkItDown("input.pdf")).rejects.toThrow(
      /not installed[\s\S]*(npm run setup:python|python -m venv)/i,
    );
  });

  it("surfaces PDF dependency setup hint on MissingDependencyException", async () => {
    mockSpawnFailure(
      "PdfConverter threw MissingDependencyException: pip install markitdown[pdf]",
    );

    await expect(convertWithMarkItDown("/tmp/doc.pdf")).rejects.toThrow(
      /MarkItDown PDF dependencies are not installed/i,
    );
  });
});

describe("convertPasteWithMarkItDown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes temp text and invokes convertWithMarkItDown", async () => {
    mockSpawnSuccess("# pasted");

    const result = await convertPasteWithMarkItDown("hello paste content here");

    expect(writeFile).toHaveBeenCalled();
    expect(spawnMock).toHaveBeenCalled();
    expect(result).toBe("# pasted");
  });
});

describe("convertUrlWithMarkItDown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes URL as CLI positional argument", async () => {
    mockSpawnSuccess("# youtube");

    const url = "https://www.youtube.com/watch?v=abc";
    await convertUrlWithMarkItDown(url);

    const [, args] = spawnMock.mock.calls[0] as [string, string[]];
    expect(args).toContain(url);
  });
});

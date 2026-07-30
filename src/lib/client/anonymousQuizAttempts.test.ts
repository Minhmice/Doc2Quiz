import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ANONYMOUS_QUIZ_OUTBOX_STORAGE_KEY,
  ANONYMOUS_QUIZ_OUTBOX_VERSION,
  enqueueAnonymousQuizAttempt,
  importPendingAnonymousQuizAttempts,
  readAnonymousQuizOutbox,
  removeAcknowledgedAnonymousQuizAttempts,
  type AnonymousQuizAttemptInput,
} from "./anonymousQuizAttempts";

const storage = new Map<string, string>();

function mockStorage() {
  return {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
    clear: () => storage.clear(),
    key: () => null,
    length: 0,
  } satisfies Storage;
}

const baseAttempt = (): AnonymousQuizAttemptInput => ({
  shareId: "a1000000-0000-4000-8000-000000000001",
  outputId: "b1000000-0000-4000-8000-000000000001",
  completedAt: "2026-07-30T10:00:00.000Z",
  correctCount: 2,
  totalQuestions: 3,
  answers: [
    { questionId: "c1000000-0000-4000-8000-000000000001", selectedIndex: 0 },
    { questionId: "c1000000-0000-4000-8000-000000000002", selectedIndex: 1 },
    { questionId: "c1000000-0000-4000-8000-000000000003", selectedIndex: 2 },
  ],
});

describe("anonymousQuizAttempts outbox", () => {
  beforeEach(() => {
    storage.clear();
    vi.restoreAllMocks();
  });

  it("discards invalid versioned outbox data", () => {
    const store = mockStorage();
    store.setItem(
      ANONYMOUS_QUIZ_OUTBOX_STORAGE_KEY,
      JSON.stringify({ version: 99, attempts: [baseAttempt()] }),
    );

    expect(readAnonymousQuizOutbox(store)).toEqual([]);
    expect(store.getItem(ANONYMOUS_QUIZ_OUTBOX_STORAGE_KEY)).toBeNull();
  });

  it("enqueues attempts with stable client ids and enforces bounds", () => {
    const store = mockStorage();
    const first = enqueueAnonymousQuizAttempt(baseAttempt(), store);
    const second = enqueueAnonymousQuizAttempt(baseAttempt(), store);

    expect(first.clientAttemptId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(second.clientAttemptId).not.toBe(first.clientAttemptId);
    expect(readAnonymousQuizOutbox(store)).toHaveLength(2);
  });

  it("removes only acknowledged attempt ids", () => {
    const store = mockStorage();
    const first = enqueueAnonymousQuizAttempt(baseAttempt(), store);
    const second = enqueueAnonymousQuizAttempt(baseAttempt(), store);

    removeAcknowledgedAnonymousQuizAttempts([first.clientAttemptId], store);

    const remaining = readAnonymousQuizOutbox(store);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.clientAttemptId).toBe(second.clientAttemptId);
  });

  it("imports pending attempts and clears only acknowledged ids", async () => {
    const store = mockStorage();
    const first = enqueueAnonymousQuizAttempt(baseAttempt(), store);
    enqueueAnonymousQuizAttempt(baseAttempt(), store);

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ acknowledgedIds: [first.clientAttemptId] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await importPendingAnonymousQuizAttempts(store);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/quiz-attempts/import",
      expect.objectContaining({ method: "POST" }),
    );
    expect(readAnonymousQuizOutbox(store)).toHaveLength(1);
    expect(readAnonymousQuizOutbox(store)[0]?.clientAttemptId).not.toBe(first.clientAttemptId);
  });

  it("retains outbox entries when import fails", async () => {
    const store = mockStorage();
    enqueueAnonymousQuizAttempt(baseAttempt(), store);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "invalid" }), { status: 400 })),
    );

    await importPendingAnonymousQuizAttempts(store);

    expect(readAnonymousQuizOutbox(store)).toHaveLength(1);
  });
});

describe("anonymousQuizAttempts constants", () => {
  it("uses the locked outbox version", () => {
    expect(ANONYMOUS_QUIZ_OUTBOX_VERSION).toBe(1);
  });
});

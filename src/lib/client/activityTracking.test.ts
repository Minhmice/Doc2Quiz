import { readFileSync } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getLatestQuizSession,
  getMistakeQuestionIds,
  hasMistakesForStudySet,
  reconcileStudySession,
  recordQuizCompletion,
} from "./activityTracking";
import type { StudySession } from "@/types/studySession";

const USER_ID = "user-xyz";
const STUDY_SET_ID = "set-456";

type MockResult = { data: unknown; error: unknown };

function createQueryChain(result: MockResult) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const self = () => chain;
  for (const method of [
    "select",
    "eq",
    "order",
    "limit",
    "insert",
    "upsert",
    "delete",
  ]) {
    chain[method] = vi.fn(self);
  }
  chain.maybeSingle = vi.fn().mockResolvedValue(result);
  chain.then = vi.fn((resolve: (value: MockResult) => void) =>
    Promise.resolve(result).then(resolve),
  ) as unknown as ReturnType<typeof vi.fn>;
  return chain;
}

const mockFrom = vi.fn();
const mockGetUser = vi.fn();
const mockRpc = vi.fn();

vi.mock("@/lib/client/supabase", () => ({
  createSupabaseBrowserClient: () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
    rpc: mockRpc,
  }),
}));

vi.mock("@/lib/ids/createRandomUuid", () => ({
  createRandomUuid: vi.fn(() => "session-uuid-1"),
}));

describe("study completion social activity exclusion", () => {
  it("does not import or emit social queue events", () => {
    const source = readFileSync(new URL("./activityTracking.ts", import.meta.url), "utf8");
    expect(source).not.toContain("activityQueue");
    expect(source).not.toContain("study_action");
  });
});

describe("recordQuizCompletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ data: null, error: null });
    mockGetUser.mockResolvedValue({
      data: { user: { id: USER_ID } },
      error: null,
    });
  });

  it("inserts quiz_sessions with score fields", async () => {
    const insertChain = createQueryChain({ data: null, error: null });
    const upsertChain = createQueryChain({ data: null, error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === "quiz_sessions") {
        return insertChain;
      }
      if (table === "study_wrong_history") {
        return upsertChain;
      }
      throw new Error(`unexpected table ${table}`);
    });

    await recordQuizCompletion({
      studySetId: STUDY_SET_ID,
      totalQuestions: 10,
      correctCount: 7,
      wrongQuestionIds: ["q-wrong-1", "q-wrong-2"],
    });

    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "session-uuid-1",
        user_id: USER_ID,
        study_set_id: STUDY_SET_ID,
        total_questions: 10,
        correct_count: 7,
        completed_at: expect.any(String),
      }),
    );
    expect(upsertChain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: USER_ID,
        study_set_id: STUDY_SET_ID,
        question_ids: ["q-wrong-1", "q-wrong-2"],
      }),
      { onConflict: "user_id,study_set_id" },
    );
  });

  it("clears study_wrong_history when there are no wrong answers", async () => {
    const insertChain = createQueryChain({ data: null, error: null });
    const deleteChain = createQueryChain({ data: null, error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === "quiz_sessions") {
        return insertChain;
      }
      if (table === "study_wrong_history") {
        return deleteChain;
      }
      throw new Error(`unexpected table ${table}`);
    });

    await recordQuizCompletion({
      studySetId: STUDY_SET_ID,
      totalQuestions: 5,
      correctCount: 5,
      wrongQuestionIds: [],
    });

    expect(deleteChain.delete).toHaveBeenCalled();
    expect(deleteChain.eq).toHaveBeenCalledWith("user_id", USER_ID);
    expect(deleteChain.eq).toHaveBeenCalledWith("study_set_id", STUDY_SET_ID);
  });
});

describe("getLatestQuizSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ data: null, error: null });
    mockGetUser.mockResolvedValue({
      data: { user: { id: USER_ID } },
      error: null,
    });
  });

  it("returns null when no sessions exist", async () => {
    mockFrom.mockReturnValue(
      createQueryChain({ data: null, error: null }),
    );

    const result = await getLatestQuizSession(STUDY_SET_ID);

    expect(result).toBeNull();
  });

  it("returns latest session score mapped for done page", async () => {
    const chain = createQueryChain({
      data: {
        id: "sess-1",
        study_set_id: STUDY_SET_ID,
        completed_at: "2026-07-25T14:30:00.000Z",
        total_questions: 8,
        correct_count: 6,
      },
      error: null,
    });
    mockFrom.mockReturnValue(chain);

    const result = await getLatestQuizSession(STUDY_SET_ID);

    expect(result).toEqual({
      correct: 6,
      total: 8,
      completedAt: "2026-07-25T14:30:00.000Z",
    });
    expect(chain.select).toHaveBeenCalledWith(
      "id,study_set_id,completed_at,total_questions,correct_count",
    );
    expect(chain.eq).toHaveBeenCalledWith("user_id", USER_ID);
    expect(chain.eq).toHaveBeenCalledWith("study_set_id", STUDY_SET_ID);
    expect(chain.order).toHaveBeenCalledWith("completed_at", {
      ascending: false,
    });
    expect(chain.limit).toHaveBeenCalledWith(1);
  });
});

describe("resumable study state", () => {
  const session: StudySession = {
    id: "session-1",
    ownerId: USER_ID,
    studySetId: STUDY_SET_ID,
    mode: "quiz",
    practice: "standard",
    itemIds: ["q-2", "q-1", "q-removed"],
    currentItemId: "q-removed",
    nextItemId: "q-1",
    interaction: {
      mode: "quiz",
      answers: { "q-2": { selectedIndex: 1, correct: false } },
    },
    revision: 3,
    startedAt: "2026-07-26T01:00:00.000Z",
    updatedAt: "2026-07-26T01:05:00.000Z",
    completedAt: null,
  };

  it("preserves surviving persisted order and appends new IDs deterministically", () => {
    const restored = reconcileStudySession(session, ["q-3", "q-1", "q-2", "q-4"]);

    expect(restored.itemIds).toEqual(["q-2", "q-1", "q-3", "q-4"]);
    expect(restored.currentItemId).toBe("q-1");
    expect(restored.nextItemId).toBe("q-1");
    expect(restored.interaction).toEqual(session.interaction);
    expect(restored.revision).toBe(3);
  });

  it("falls back to the first surviving item when both pointers were removed", () => {
    const restored = reconcileStudySession(
      { ...session, nextItemId: "q-removed-too" },
      ["q-3", "q-2"],
    );

    expect(restored.itemIds).toEqual(["q-2", "q-3"]);
    expect(restored.currentItemId).toBe("q-2");
    expect(restored.nextItemId).toBe("q-3");
  });

  it("keeps quiz and flashcard interaction payloads mode-specific", () => {
    const flashcard = reconcileStudySession(
      {
        ...session,
        mode: "flashcard",
        interaction: {
          mode: "flashcard",
          cards: { "card-1": { known: true, rating: "good" } },
        },
        itemIds: ["card-1"],
        currentItemId: "card-1",
        nextItemId: null,
      },
      ["card-1"],
    );

    expect(flashcard.interaction).toEqual({
      mode: "flashcard",
      cards: { "card-1": { known: true, rating: "good" } },
    });
  });
});

describe("mistake helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ data: null, error: null });
    mockGetUser.mockResolvedValue({
      data: { user: { id: USER_ID } },
      error: null,
    });
  });

  it("getMistakeQuestionIds returns stored question ids", async () => {
    mockFrom.mockReturnValue(
      createQueryChain({
        data: { question_ids: ["q-1", "q-2"] },
        error: null,
      }),
    );

    await expect(getMistakeQuestionIds(STUDY_SET_ID)).resolves.toEqual([
      "q-1",
      "q-2",
    ]);
  });

  it("hasMistakesForStudySet is true when ids exist", async () => {
    mockFrom.mockReturnValue(
      createQueryChain({
        data: { question_ids: ["q-1"] },
        error: null,
      }),
    );

    await expect(hasMistakesForStudySet(STUDY_SET_ID)).resolves.toBe(true);
  });
});

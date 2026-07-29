import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ApprovedFlashcardBank } from "@/types/flashcard";
import type { ApprovedBank } from "@/types/question";

import {
  getApprovedBank,
  getApprovedFlashcardBank,
  putApprovedBankForStudySet,
  putApprovedFlashcardBankForStudySet,
} from "./studySetDb";

const USER_ID = "user-abc";
const STUDY_SET_ID = "set-123";

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
    "in",
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

vi.mock("@/lib/client/supabase", () => ({
  createSupabaseBrowserClient: () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}));

describe("getApprovedBank", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: USER_ID } },
      error: null,
    });
  });

  it("returns null when no approved questions exist", async () => {
    mockFrom.mockReturnValue(
      createQueryChain({ data: [], error: null }),
    );

    const result = await getApprovedBank(STUDY_SET_ID);

    expect(result).toBeNull();
  });

  it("maps database rows to Question shape including explanation and sourceChunkId", async () => {
    mockFrom.mockReturnValue(
      createQueryChain({
        data: [
          {
            id: "q-1",
            prompt: "What is ATP?",
            choices: ["A", "B", "C", "D"],
            correct_index: 1,
            explanation: "Energy currency of the cell.",
            source: { concept_id: "concept_001" },
            updated_at: "2026-07-25T10:00:00.000Z",
          },
        ],
        error: null,
      }),
    );

    const result = await getApprovedBank(STUDY_SET_ID);

    expect(result).not.toBeNull();
    expect(result?.version).toBe(1);
    expect(result?.questions).toHaveLength(1);
    expect(result?.questions[0]).toMatchObject({
      id: "q-1",
      question: "What is ATP?",
      options: ["A", "B", "C", "D"],
      correctIndex: 1,
      explanation: "Energy currency of the cell.",
      sourceChunkId: "concept_001",
    });
    expect(result?.savedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("scopes queries by authenticated user_id and study_set_id", async () => {
    const chain = createQueryChain({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    await getApprovedBank(STUDY_SET_ID);

    expect(mockFrom).toHaveBeenCalledWith("approved_questions");
    expect(chain.select).toHaveBeenCalledWith(
      "id,prompt,choices,correct_index,explanation,source,updated_at",
    );
    expect(chain.eq).toHaveBeenCalledWith("user_id", USER_ID);
    expect(chain.eq).toHaveBeenCalledWith("study_set_id", STUDY_SET_ID);
    expect(chain.order).toHaveBeenCalledWith("updated_at", { ascending: true });
  });
});

describe("putApprovedBankForStudySet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: USER_ID } },
      error: null,
    });
  });

  it("upserts questions and deletes orphan rows", async () => {
    const listChain = createQueryChain({
      data: [{ id: "keep-1" }, { id: "orphan-2" }],
      error: null,
    });
    const upsertChain = createQueryChain({ data: null, error: null });
    const deleteChain = createQueryChain({ data: null, error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table !== "approved_questions") {
        throw new Error(`unexpected table ${table}`);
      }
      if (!listChain.select.mock.calls.length) {
        return listChain;
      }
      if (!upsertChain.upsert.mock.calls.length) {
        return upsertChain;
      }
      return deleteChain;
    });

    const bank: ApprovedBank = {
      version: 1,
      savedAt: "2026-07-25T12:00:00.000Z",
      questions: [
        {
          id: "keep-1",
          question: "Updated prompt?",
          options: ["Yes", "No", "Maybe", "N/A"],
          correctIndex: 0,
          explanation: "Still valid.",
          sourceChunkId: "concept_002",
        },
      ],
    };

    await putApprovedBankForStudySet(STUDY_SET_ID, bank);

    expect(upsertChain.upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          id: "keep-1",
          user_id: USER_ID,
          study_set_id: STUDY_SET_ID,
          prompt: "Updated prompt?",
          choices: ["Yes", "No", "Maybe", "N/A"],
          correct_index: 0,
          explanation: "Still valid.",
          source: { concept_id: "concept_002" },
          updated_at: bank.savedAt,
        }),
      ],
      { onConflict: "id" },
    );
    expect(deleteChain.delete).toHaveBeenCalled();
    expect(deleteChain.in).toHaveBeenCalledWith("id", ["orphan-2"]);
  });

  it("deletes all rows when bank has zero questions", async () => {
    const listChain = createQueryChain({
      data: [{ id: "old-1" }],
      error: null,
    });
    const deleteAllChain = createQueryChain({ data: null, error: null });

    mockFrom.mockImplementation(() => {
      if (!listChain.select.mock.calls.length) {
        return listChain;
      }
      return deleteAllChain;
    });

    await putApprovedBankForStudySet(STUDY_SET_ID, {
      version: 1,
      savedAt: "2026-07-25T12:00:00.000Z",
      questions: [],
    });

    expect(deleteAllChain.delete).toHaveBeenCalled();
    expect(deleteAllChain.eq).toHaveBeenCalledWith("user_id", USER_ID);
    expect(deleteAllChain.eq).toHaveBeenCalledWith("study_set_id", STUDY_SET_ID);
  });
});

describe("getApprovedFlashcardBank", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: USER_ID } },
      error: null,
    });
  });

  it("returns null when no approved flashcards exist", async () => {
    mockFrom.mockReturnValue(
      createQueryChain({ data: [], error: null }),
    );

    const result = await getApprovedFlashcardBank(STUDY_SET_ID);

    expect(result).toBeNull();
  });

  it("maps database rows to FlashcardVisionItem shape (id, front, back only)", async () => {
    mockFrom.mockReturnValue(
      createQueryChain({
        data: [
          {
            id: "fc-1",
            front: "What is ATP?",
            back: "Energy currency of the cell.",
            tags: ["biology"],
            source: { kind: "flashcard", confidence: 0.9 },
            updated_at: "2026-07-25T10:00:00.000Z",
          },
        ],
        error: null,
      }),
    );

    const result = await getApprovedFlashcardBank(STUDY_SET_ID);

    expect(result).not.toBeNull();
    expect(result?.version).toBe(1);
    expect(result?.items).toHaveLength(1);
    expect(result?.items[0]).toEqual({
      id: "fc-1",
      front: "What is ATP?",
      back: "Energy currency of the cell.",
    });
    expect(result?.savedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("scopes queries by authenticated user_id and study_set_id", async () => {
    const chain = createQueryChain({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    await getApprovedFlashcardBank(STUDY_SET_ID);

    expect(mockFrom).toHaveBeenCalledWith("approved_flashcards");
    expect(chain.select).toHaveBeenCalledWith(
      "id,front,back,tags,source,updated_at",
    );
    expect(chain.eq).toHaveBeenCalledWith("user_id", USER_ID);
    expect(chain.eq).toHaveBeenCalledWith("study_set_id", STUDY_SET_ID);
    expect(chain.order).toHaveBeenCalledWith("updated_at", { ascending: true });
  });
});

describe("putApprovedFlashcardBankForStudySet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: USER_ID } },
      error: null,
    });
  });

  it("upserts flashcards and deletes orphan rows", async () => {
    const listChain = createQueryChain({
      data: [
        {
          id: "keep-1",
          tags: ["existing-tag"],
          source: { concept_id: "concept_001" },
        },
        { id: "orphan-2", tags: [], source: {} },
      ],
      error: null,
    });
    const upsertChain = createQueryChain({ data: null, error: null });
    const deleteChain = createQueryChain({ data: null, error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table !== "approved_flashcards") {
        throw new Error(`unexpected table ${table}`);
      }
      if (!listChain.select.mock.calls.length) {
        return listChain;
      }
      if (!upsertChain.upsert.mock.calls.length) {
        return upsertChain;
      }
      return deleteChain;
    });

    const bank: ApprovedFlashcardBank = {
      version: 1,
      savedAt: "2026-07-25T12:00:00.000Z",
      items: [
        {
          id: "keep-1",
          front: "Updated front",
          back: "Updated back",
        },
      ],
    };

    await putApprovedFlashcardBankForStudySet(STUDY_SET_ID, bank);

    expect(listChain.select).toHaveBeenCalledWith("id,tags,source");
    expect(upsertChain.upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          id: "keep-1",
          user_id: USER_ID,
          study_set_id: STUDY_SET_ID,
          front: "Updated front",
          back: "Updated back",
          tags: ["existing-tag"],
          source: { concept_id: "concept_001" },
          updated_at: bank.savedAt,
        }),
      ],
      { onConflict: "id" },
    );
    expect(deleteChain.delete).toHaveBeenCalled();
    expect(deleteChain.in).toHaveBeenCalledWith("id", ["orphan-2"]);
  });

  it("deletes all rows when bank has zero items", async () => {
    const listChain = createQueryChain({
      data: [{ id: "old-1", tags: [], source: {} }],
      error: null,
    });
    const deleteAllChain = createQueryChain({ data: null, error: null });

    mockFrom.mockImplementation(() => {
      if (!listChain.select.mock.calls.length) {
        return listChain;
      }
      return deleteAllChain;
    });

    await putApprovedFlashcardBankForStudySet(STUDY_SET_ID, {
      version: 1,
      savedAt: "2026-07-25T12:00:00.000Z",
      items: [],
    });

    expect(deleteAllChain.delete).toHaveBeenCalled();
    expect(deleteAllChain.eq).toHaveBeenCalledWith("user_id", USER_ID);
    expect(deleteAllChain.eq).toHaveBeenCalledWith("study_set_id", STUDY_SET_ID);
  });
});

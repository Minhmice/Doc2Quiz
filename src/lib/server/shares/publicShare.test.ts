import { createHash, randomBytes } from "crypto";
import { describe, expect, it, vi } from "vitest";

import { PublicShareError, resolvePublicShare } from "./publicShare";
import { digestShareToken, issueShareToken } from "./shareToken";

describe("shareToken", () => {
  it("base64url-encodes 32 random bytes and SHA-256 digests without persisting plaintext", () => {
    const { token, digest } = issueShareToken();
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
    expect(digest).toHaveLength(32);
    expect(digestShareToken(token)).toEqual(digest);
  });

  it("rejects malformed tokens identically", () => {
    expect(() => digestShareToken("not-base64url!!!")).toThrow();
    expect(() => digestShareToken("YWJj")).toThrow();
  });
});

describe("resolvePublicShare", () => {
  const quizPayload = {
    shareId: "share-1",
    permission: "study" as const,
    target: {
      kind: "quiz" as const,
      outputId: "out-1",
      title: "Quiz title",
      questions: [
        {
          id: "q-1",
          prompt: "Prompt?",
          choices: ["A", "B", "C", "D"],
          correctIndex: 0,
          explanation: "Because",
        },
      ],
    },
  };

  function rpcFor(payload: unknown | null, message?: string) {
    return {
      rpc: vi.fn().mockResolvedValue({
        data: payload,
        error: message ? { message } : null,
      }),
    };
  }

  it("resolves active quiz share with locked study fields only", async () => {
    const secret = randomBytes(32);
    const token = secret.toString("base64url");
    const digest = createHash("sha256").update(secret).digest();
    const supabase = rpcFor(quizPayload);

    await expect(resolvePublicShare(supabase as never, token)).resolves.toEqual(
      quizPayload,
    );

    expect(supabase.rpc).toHaveBeenCalledWith("resolve_public_share_by_digest", {
      p_token_digest: `\\x${Buffer.from(digest).toString("hex")}`,
    });
    expect(JSON.stringify(quizPayload)).not.toMatch(
      /user_id|workspace_id|study_set_id|source|token_digest|created_by/i,
    );
  });

  it("maps unknown, revoked, expired, and invalid tokens to not_found", async () => {
    const secret = randomBytes(32);
    const token = secret.toString("base64url");
    const supabase = rpcFor(null, "not_found");

    await expect(resolvePublicShare(supabase as never, token)).rejects.toEqual(
      new PublicShareError("not_found"),
    );
    await expect(resolvePublicShare(supabase as never, "!!!")).rejects.toEqual(
      new PublicShareError("not_found"),
    );
  });

  it("rejects projections that leak private fields", async () => {
    const secret = randomBytes(32);
    const token = secret.toString("base64url");
    const supabase = rpcFor({
      ...quizPayload,
      target: {
        ...quizPayload.target,
        questions: [{ ...quizPayload.target.questions[0], user_id: "leak" }],
      },
    });

    await expect(resolvePublicShare(supabase as never, token)).rejects.toThrow(
      /public_share_projection_leak/,
    );
  });
});

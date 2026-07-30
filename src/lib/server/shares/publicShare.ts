import type { SupabaseClient } from "@supabase/supabase-js";

import { digestShareToken, digestToPostgresHex, ShareTokenError } from "./shareToken";

export type PublicShareQuizQuestion = {
  id: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
  explanation: string | null;
};

export type PublicShareQuizTarget = {
  kind: "quiz";
  title: string;
  questions: PublicShareQuizQuestion[];
};

export type PublicShareFlashcardCard = {
  id: string;
  front: string;
  back: string;
};

export type PublicShareFlashcardTarget = {
  kind: "flashcard";
  title: string;
  cards: PublicShareFlashcardCard[];
};

export type PublicShareWorkspaceOutput = {
  id: string;
  kind: "quiz" | "flashcard";
  title: string;
};

export type PublicShareWorkspaceTarget = {
  kind: "workspace";
  title: string;
  outputs: PublicShareWorkspaceOutput[];
};

export type PublicShareTarget =
  | PublicShareQuizTarget
  | PublicShareFlashcardTarget
  | PublicShareWorkspaceTarget;

export type PublicShareDto = {
  shareId: string;
  permission: "view" | "study";
  target: PublicShareTarget;
};

export class PublicShareError extends Error {
  constructor(readonly code: "not_found") {
    super(code);
    this.name = "PublicShareError";
  }
}

const PRIVATE_FIELD_PATTERN =
  /user_id|workspace_id|study_set_id|source|token_digest|created_by|generation_provenance|storage|owner_id|member/i;

type RpcClient = Pick<SupabaseClient, "rpc">;

function assertSafeProjection(payload: unknown): void {
  const serialized = JSON.stringify(payload);
  if (PRIVATE_FIELD_PATTERN.test(serialized)) {
    throw new Error("public_share_projection_leak");
  }
}

function mapRpcFailure(error: { message: string }): PublicShareError {
  if (error.message.includes("not_found")) {
    return new PublicShareError("not_found");
  }
  return new PublicShareError("not_found");
}

export async function resolvePublicShare(
  supabase: RpcClient,
  token: string,
): Promise<PublicShareDto> {
  let digest: Uint8Array;
  try {
    digest = digestShareToken(token);
  } catch (error) {
    if (error instanceof ShareTokenError) {
      throw new PublicShareError("not_found");
    }
    throw error;
  }

  const { data, error } = await supabase.rpc("resolve_public_share_by_digest", {
    p_token_digest: digestToPostgresHex(digest),
  });

  if (error) {
    throw mapRpcFailure(error);
  }
  if (!data) {
    throw new PublicShareError("not_found");
  }

  assertSafeProjection(data);
  return data as PublicShareDto;
}

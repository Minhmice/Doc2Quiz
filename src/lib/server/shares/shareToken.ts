import { createHash, randomBytes } from "crypto";

const SHARE_TOKEN_BYTES = 32;
const SHARE_DIGEST_BYTES = 32;

export class ShareTokenError extends Error {
  constructor(readonly code: "invalid") {
    super(code);
    this.name = "ShareTokenError";
  }
}

export function issueShareToken(): { token: string; digest: Uint8Array } {
  const secret = randomBytes(SHARE_TOKEN_BYTES);
  const digest = createHash("sha256").update(secret).digest();
  return {
    token: secret.toString("base64url"),
    digest: new Uint8Array(digest),
  };
}

export function digestShareToken(token: string): Uint8Array {
  let secret: Buffer;
  try {
    secret = Buffer.from(token, "base64url");
  } catch {
    throw new ShareTokenError("invalid");
  }

  if (secret.length !== SHARE_TOKEN_BYTES) {
    throw new ShareTokenError("invalid");
  }

  const digest = createHash("sha256").update(secret).digest();
  if (digest.length !== SHARE_DIGEST_BYTES) {
    throw new ShareTokenError("invalid");
  }

  return new Uint8Array(digest);
}

export function digestToPostgresHex(digest: Uint8Array): string {
  return `\\x${Buffer.from(digest).toString("hex")}`;
}

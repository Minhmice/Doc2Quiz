import { createHmac, timingSafeEqual } from "node:crypto";

import {
  type PdfUploadFinalizeTokenPayloadV1,
  stableSerializeFinalizePayload,
} from "@/lib/uploads/pdfUploadContracts";

const TOKEN_PREFIX = "d2qft1.";

function b64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function b64urlToBuf(s: string): Buffer | null {
  try {
    const pad = 4 - (s.length % 4 || 4);
    const padded = s + (pad === 4 ? "" : "=".repeat(pad));
    const norm = padded.replace(/-/g, "+").replace(/_/g, "/");
    return Buffer.from(norm, "base64");
  } catch {
    return null;
  }
}

export function signPdfUploadFinalizeToken(
  payload: PdfUploadFinalizeTokenPayloadV1,
  secret: string,
): string {
  const body = stableSerializeFinalizePayload(payload);
  const mac = createHmac("sha256", secret).update(body).digest();
  return `${TOKEN_PREFIX}${b64url(Buffer.from(body, "utf8"))}.${b64url(mac)}`;
}

export function verifyPdfUploadFinalizeToken(
  token: string,
  secret: string,
): { ok: true; payload: PdfUploadFinalizeTokenPayloadV1 } | { ok: false } {
  if (!token.startsWith(TOKEN_PREFIX)) {
    return { ok: false };
  }
  const rest = token.slice(TOKEN_PREFIX.length);
  const dot = rest.lastIndexOf(".");
  if (dot <= 0) {
    return { ok: false };
  }
  const payloadB64 = rest.slice(0, dot);
  const sigB64 = rest.slice(dot + 1);
  const payloadBuf = b64urlToBuf(payloadB64);
  const sigBuf = b64urlToBuf(sigB64);
  if (!payloadBuf || !sigBuf) {
    return { ok: false };
  }
  const body = payloadBuf.toString("utf8");
  const expected = createHmac("sha256", secret).update(body).digest();
  if (expected.length !== sigBuf.length || !timingSafeEqual(expected, sigBuf)) {
    return { ok: false };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(body) as unknown;
  } catch {
    return { ok: false };
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    (parsed as { v?: unknown }).v !== 1
  ) {
    return { ok: false };
  }
  const o = parsed as Record<string, unknown>;
  const uploadId = o.uploadId;
  const key = o.key;
  const sizeBytes = o.sizeBytes;
  const contentType = o.contentType;
  const expiresAt = o.expiresAt;
  if (
    typeof uploadId !== "string" ||
    typeof key !== "string" ||
    typeof sizeBytes !== "number" ||
    !Number.isFinite(sizeBytes) ||
    typeof contentType !== "string" ||
    typeof expiresAt !== "string"
  ) {
    return { ok: false };
  }
  return {
    ok: true,
    payload: {
      v: 1,
      uploadId,
      key,
      sizeBytes,
      contentType,
      expiresAt,
    },
  };
}

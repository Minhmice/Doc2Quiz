import { createHash } from "crypto";

export function sha256Utf8HexSync(message: string): string {
  return createHash("sha256").update(message, "utf8").digest("hex");
}

export function sha256BufferHexSync(buffer: ArrayBuffer): string {
  return createHash("sha256").update(Buffer.from(buffer)).digest("hex");
}

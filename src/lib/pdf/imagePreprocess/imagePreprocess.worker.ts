/// <reference lib="webworker" />

export {};

type EncodeJpegRequest = {
  type: "encode-jpeg";
  requestId: string;
  bitmap: ImageBitmap;
  maxWidth: number;
  maxHeight: number;
  jpegQuality: number;
};

type EncodeJpegOkResponse = {
  type: "encode-jpeg-result";
  requestId: string;
  ok: true;
  dataUrl: string;
};

type EncodeJpegErrorResponse = {
  type: "encode-jpeg-result";
  requestId: string;
  ok: false;
  error: { name: string; message: string };
};

type EncodeJpegResponse = EncodeJpegOkResponse | EncodeJpegErrorResponse;

function clampNumber(value: number, opts: { min: number; max: number }): number {
  if (!Number.isFinite(value)) return opts.min;
  return Math.min(opts.max, Math.max(opts.min, value));
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function encodeJpegDataUrlFromBitmap(
  bitmap: ImageBitmap,
  opts: { maxWidth: number; maxHeight: number; jpegQuality: number },
): Promise<string> {
  const maxWidth = clampNumber(opts.maxWidth, { min: 1, max: 8192 });
  const maxHeight = clampNumber(opts.maxHeight, { min: 1, max: 8192 });
  const jpegQuality = clampNumber(opts.jpegQuality, { min: 0.05, max: 0.95 });

  const scale = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height);
  const targetWidth = Math.max(1, Math.floor(bitmap.width * scale));
  const targetHeight = Math.max(1, Math.floor(bitmap.height * scale));

  const canvas = new OffscreenCanvas(targetWidth, targetHeight);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("OffscreenCanvas 2D context not available");
  }

  ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
  bitmap.close();

  const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: jpegQuality });
  const base64 = arrayBufferToBase64(await blob.arrayBuffer());
  return `data:image/jpeg;base64,${base64}`;
}

self.addEventListener("message", (event: MessageEvent<unknown>) => {
  const msg = event.data as Partial<EncodeJpegRequest> | null;
  if (!msg || msg.type !== "encode-jpeg") {
    return;
  }

  const requestId = typeof msg.requestId === "string" ? msg.requestId : "";
  const bitmap = msg.bitmap;
  if (!requestId || !bitmap) {
    const response: EncodeJpegResponse = {
      type: "encode-jpeg-result",
      requestId,
      ok: false,
      error: { name: "TypeError", message: "Invalid worker request payload" },
    };
    self.postMessage(response);
    return;
  }

  void (async () => {
    try {
      const dataUrl = await encodeJpegDataUrlFromBitmap(bitmap, {
        maxWidth: typeof msg.maxWidth === "number" ? msg.maxWidth : 1,
        maxHeight: typeof msg.maxHeight === "number" ? msg.maxHeight : 1,
        jpegQuality: typeof msg.jpegQuality === "number" ? msg.jpegQuality : 0.68,
      });
      const response: EncodeJpegResponse = {
        type: "encode-jpeg-result",
        requestId,
        ok: true,
        dataUrl,
      };
      self.postMessage(response);
    } catch (err) {
      try {
        bitmap.close();
      } catch {
        // ignore
      }
      const e = err instanceof Error ? err : new Error(String(err));
      const response: EncodeJpegResponse = {
        type: "encode-jpeg-result",
        requestId,
        ok: false,
        error: { name: e.name || "Error", message: e.message || "Worker encode failed" },
      };
      self.postMessage(response);
    }
  })();
});


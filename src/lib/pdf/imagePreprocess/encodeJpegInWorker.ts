"use client";

type EncodeJpegWorkerRequest = {
  type: "encode-jpeg";
  requestId: string;
  bitmap: ImageBitmap;
  maxWidth: number;
  maxHeight: number;
  jpegQuality: number;
};

type EncodeJpegWorkerResponse =
  | {
      type: "encode-jpeg-result";
      requestId: string;
      ok: true;
      dataUrl: string;
    }
  | {
      type: "encode-jpeg-result";
      requestId: string;
      ok: false;
      error: { name: string; message: string };
    };

export type EncodeJpegDataUrlInWorkerInput = {
  canvas: HTMLCanvasElement;
  maxWidth: number;
  maxHeight: number;
  jpegQuality: number;
  signal: AbortSignal;
};

function createAbortError(): DOMException {
  return new DOMException("Aborted", "AbortError");
}

function isProbablyJpegDataUrl(dataUrl: string): boolean {
  return dataUrl.startsWith("data:image/jpeg;base64,");
}

function canCreateWorker(): boolean {
  return typeof Worker !== "undefined";
}

function canEncodeJpegInWorker(): boolean {
  if (!canCreateWorker()) return false;
  if (typeof createImageBitmap === "undefined") return false;
  if (typeof OffscreenCanvas === "undefined") return false;
  try {
    const c = new OffscreenCanvas(1, 1) as OffscreenCanvas;
    return typeof (c as unknown as { convertToBlob?: unknown }).convertToBlob === "function";
  } catch {
    return false;
  }
}

export function canUseImagePreprocessWorker(): boolean {
  return canEncodeJpegInWorker();
}

let singletonWorker: Worker | null = null;
let workerBroken = false;

function getOrCreateWorker(): Worker {
  if (workerBroken) {
    throw new Error("Image preprocess worker is unavailable");
  }
  if (singletonWorker) {
    return singletonWorker;
  }
  if (!canCreateWorker()) {
    throw new Error("Worker API not available");
  }
  try {
    singletonWorker = new Worker(new URL("./imagePreprocess.worker.ts", import.meta.url), {
      type: "module",
    });
    singletonWorker.addEventListener("error", () => {
      workerBroken = true;
    });
    singletonWorker.addEventListener("messageerror", () => {
      workerBroken = true;
    });
    return singletonWorker;
  } catch (err) {
    workerBroken = true;
    throw err instanceof Error ? err : new Error(String(err));
  }
}

type PendingJob = {
  input: EncodeJpegDataUrlInWorkerInput;
  resolve: (dataUrl: string) => void;
  reject: (err: unknown) => void;
};

const pendingQueue: PendingJob[] = [];
let inFlight = false;
let requestSeq = 0;

function nextRequestId(): string {
  requestSeq += 1;
  return `imgprep_${Date.now()}_${requestSeq}`;
}

function drainQueue(): void {
  if (inFlight) return;
  const job = pendingQueue.shift();
  if (!job) return;
  inFlight = true;

  void (async () => {
    const { signal } = job.input;
    let settled = false;
    const settleReject = (err: unknown) => {
      if (settled) return;
      settled = true;
      job.reject(err);
    };
    const settleResolve = (dataUrl: string) => {
      if (settled) return;
      settled = true;
      job.resolve(dataUrl);
    };

    if (signal.aborted) {
      settleReject(createAbortError());
      return;
    }
    if (!canEncodeJpegInWorker()) {
      settleReject(new Error("Image preprocess worker APIs not available"));
      return;
    }

    let bitmap: ImageBitmap | null = null;
    let abortCleanup: (() => void) | null = null;
    const requestId = nextRequestId();
    try {
      bitmap = await createImageBitmap(job.input.canvas);
      const bitmapToSend = bitmap;
      if (!bitmapToSend) {
        settleReject(new Error("createImageBitmap returned null"));
        return;
      }
      if (signal.aborted) {
        try {
          bitmapToSend.close();
        } catch {
          // ignore
        }
        settleReject(createAbortError());
        return;
      }

      const worker = getOrCreateWorker();
      const onAbort = () => {
        settleReject(createAbortError());
      };
      signal.addEventListener("abort", onAbort, { once: true });
      abortCleanup = () => signal.removeEventListener("abort", onAbort);

      const response = await new Promise<EncodeJpegWorkerResponse>((resolve, reject) => {
        const onMessage = (event: MessageEvent<unknown>) => {
          const msg = event.data as Partial<EncodeJpegWorkerResponse> | null;
          if (!msg || msg.type !== "encode-jpeg-result") return;
          if (msg.requestId !== requestId) return;
          cleanup();
          resolve(msg as EncodeJpegWorkerResponse);
        };
        const onError = () => {
          cleanup();
          workerBroken = true;
          reject(new Error("Image preprocess worker error"));
        };
        const cleanup = () => {
          worker.removeEventListener("message", onMessage);
          worker.removeEventListener("error", onError);
          worker.removeEventListener("messageerror", onError);
        };

        worker.addEventListener("message", onMessage);
        worker.addEventListener("error", onError);
        worker.addEventListener("messageerror", onError);

        const req: EncodeJpegWorkerRequest = {
          type: "encode-jpeg",
          requestId,
          bitmap: bitmapToSend,
          maxWidth: job.input.maxWidth,
          maxHeight: job.input.maxHeight,
          jpegQuality: job.input.jpegQuality,
        };
        worker.postMessage(req, [bitmapToSend]);
      });

      if (signal.aborted) {
        settleReject(createAbortError());
        return;
      }

      if (!response.ok) {
        const err = new Error(response.error.message);
        err.name = response.error.name || "Error";
        settleReject(err);
        return;
      }

      if (!isProbablyJpegDataUrl(response.dataUrl)) {
        settleReject(new Error("Worker returned unexpected dataUrl format"));
        return;
      }
      settleResolve(response.dataUrl);
    } catch (err) {
      settleReject(err);
    } finally {
      try {
        abortCleanup?.();
      } catch {
        // ignore
      }
      try {
        bitmap?.close();
      } catch {
        // ignore
      }
      inFlight = false;
      drainQueue();
    }
  })();
}

export function encodeJpegDataUrlInWorker(
  input: EncodeJpegDataUrlInWorkerInput,
): Promise<string> {
  if (input.signal.aborted) {
    return Promise.reject(createAbortError());
  }
  if (!canEncodeJpegInWorker()) {
    return Promise.reject(new Error("Image preprocess worker not supported"));
  }

  return new Promise<string>((resolve, reject) => {
    pendingQueue.push({ input, resolve, reject });
    drainQueue();
  });
}


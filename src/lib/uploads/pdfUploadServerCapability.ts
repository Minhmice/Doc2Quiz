import type {
  PdfUploadCapability,
  PdfUploadCapabilityReason,
} from "@/types/uploads";

function truthyEnv(name: string): boolean {
  const v = process.env[name]?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/**
 * Server-only: derives upload capability from env (D-01).
 * `D2Q_OBJECT_STORAGE_ADAPTER_READY` is a deliberate second gate so “enabled”
 * alone cannot imply a working presign/finalize path during adapter rollout.
 */
export function getPdfUploadServerCapability(): PdfUploadCapability {
  const configured = truthyEnv("D2Q_OBJECT_STORAGE_ENABLED");
  const providerReady =
    configured && truthyEnv("D2Q_OBJECT_STORAGE_ADAPTER_READY");
  const mode =
    configured && providerReady ? "direct-upload" : "local-only";
  let reason: PdfUploadCapabilityReason | undefined;
  if (mode === "local-only") {
    reason = !configured ? "not_configured" : "provider_not_ready";
  }
  return {
    configured,
    providerReady,
    mode,
    ...(reason ? { reason } : {}),
  };
}

export function getPdfUploadFinalizeSecret(): string | null {
  const s = process.env.D2Q_PDF_UPLOAD_FINALIZE_SECRET?.trim();
  return s && s.length > 0 ? s : null;
}

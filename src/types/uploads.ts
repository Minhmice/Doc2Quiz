/**
 * Same-origin PDF upload contract (Phase 26). Provider-agnostic; presign/finalize
 * behavior is implemented per deployment via env + future adapters.
 */

export type PdfUploadCapabilityMode = "local-only" | "direct-upload";

export type PdfUploadCapabilityReason =
  | "not_configured"
  | "provider_not_ready";

export type PdfUploadCapability = {
  configured: boolean;
  providerReady: boolean;
  mode: PdfUploadCapabilityMode;
  reason?: PdfUploadCapabilityReason;
};

/** Supports multipart-style and resumable-session adapters (D-08). */
export type PdfUploadProtocolKind = "multipart" | "resumable";

export type PdfUploadSessionDescriptor = {
  uploadId: string;
  key: string;
  sizeBytes: number;
  contentType: string;
  expiresAt: string;
  protocol: PdfUploadProtocolKind;
};

export type PdfUploadInitRequest = {
  contentType: string;
  sizeBytes: number;
  /** Optional hint only; server never trusts raw filenames as the object key. */
  suggestedSuffix?: string;
};

export type PdfUploadInitResponse = {
  uploadCapability: PdfUploadCapability;
  session?: PdfUploadSessionDescriptor;
  finalizeToken?: string;
  multipart?: {
    partSizeBytes: number;
    totalParts: number;
  };
  resumable?: {
    /** Stub: populated when an adapter uses session-style uploads. */
    sessionUrl?: string;
  };
};

export type PdfUploadPartRequest = {
  session: PdfUploadSessionDescriptor;
  partNumber: number;
  byteStart: number;
  byteEndInclusive: number;
};

export type PdfUploadPartResponse = {
  uploadCapability: PdfUploadCapability;
  uploadUrl?: string;
  /** Machine-oriented detail; avoid showing raw provider errors to users when possible. */
  error?: string;
};

export type PdfUploadCompletePart = {
  partNumber: number;
  etag?: string;
};

export type PdfUploadCompleteRequest = {
  session: PdfUploadSessionDescriptor;
  parts: PdfUploadCompletePart[];
  finalizeToken: string;
};

export type PdfUploadCompleteResponse = {
  uploadCapability: PdfUploadCapability;
  finalized: boolean;
  error?: string;
  userMessage?: string;
};

export type PdfUploadAbortRequest = {
  session: PdfUploadSessionDescriptor;
};

export type PdfUploadAbortResponse = {
  uploadCapability: PdfUploadCapability;
  ok: boolean;
};

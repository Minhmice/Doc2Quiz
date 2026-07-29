import { CanonicalMetadataChips } from "@/components/canonical/CanonicalMetadataChips";
import type { CanonicalDocumentMetadata } from "@/lib/client/canonicalizeStudySet";

export type CanonicalPreviewHeaderProps = Readonly<{
  title: string;
  sourceFileName?: string | null;
  metadata?: CanonicalDocumentMetadata | null;
  sectionCount?: number;
  chipsLoading?: boolean;
}>;

export function CanonicalPreviewHeader({
  title,
  sourceFileName,
  metadata,
  sectionCount,
  chipsLoading = false,
}: CanonicalPreviewHeaderProps) {
  return (
    <header className="space-y-4">
      <p className="font-label text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
        Study set
        {sourceFileName ? (
          <span className="normal-case tracking-normal">
            {" "}
            · {sourceFileName}
          </span>
        ) : null}
      </p>
      <div className="space-y-2">
        <h1 className="font-heading text-2xl font-extrabold tracking-tight text-foreground">
          Canonical knowledge · {title}
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Read-only preview of cleaned, structured content. Choose a learning
          mode in the next step.
        </p>
      </div>
      <CanonicalMetadataChips
        metadata={metadata}
        sectionCount={sectionCount}
        loading={chipsLoading}
      />
    </header>
  );
}

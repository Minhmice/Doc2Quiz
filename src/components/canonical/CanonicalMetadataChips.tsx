import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { CanonicalDocumentMetadata } from "@/lib/client/canonicalizeStudySet";

export type CanonicalMetadataChipsProps = Readonly<{
  metadata?: CanonicalDocumentMetadata | null;
  sectionCount?: number;
  loading?: boolean;
}>;

function formatLanguage(value: string | undefined): string {
  if (!value) {
    return "—";
  }
  return value.toUpperCase();
}

function formatContentType(value: string | undefined): string {
  if (!value) {
    return "—";
  }
  switch (value.toLowerCase()) {
    case "theory":
      return "Theory";
    case "exam":
      return "Exam";
    case "mixed":
      return "Mixed";
    default:
      return value;
  }
}

function formatSectionCount(count: number | undefined): string {
  if (count === undefined || count < 0) {
    return "—";
  }
  if (count === 1) {
    return "1 section";
  }
  return `${count} sections`;
}

export function CanonicalMetadataChips({
  metadata,
  sectionCount,
  loading = false,
}: CanonicalMetadataChipsProps) {
  if (loading) {
    return (
      <div className="flex flex-wrap gap-2" aria-busy="true">
        <Skeleton className="h-5 w-20 rounded-4xl" />
        <Skeleton className="h-5 w-20 rounded-4xl" />
        <Skeleton className="h-5 w-24 rounded-4xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Badge variant="outline">
        Language {formatLanguage(metadata?.language)}
      </Badge>
      <Badge variant="outline">
        Content {formatContentType(metadata?.content_type)}
      </Badge>
      <Badge variant="outline">
        Sections {formatSectionCount(sectionCount)}
      </Badge>
    </div>
  );
}

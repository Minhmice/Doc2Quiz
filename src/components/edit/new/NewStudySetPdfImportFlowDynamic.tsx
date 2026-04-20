"use client";

import dynamic from "next/dynamic";
import { ImportFlowSkeleton } from "@/components/edit/new/ImportFlowSkeleton";
import type { NewStudySetPdfImportFlowProps } from "@/app/(app)/edit/new/NewStudySetPdfImportFlow";

const NewStudySetPdfImportFlow = dynamic(
  () =>
    import("@/app/(app)/edit/new/NewStudySetPdfImportFlow").then(
      (m) => m.NewStudySetPdfImportFlow,
    ),
  { ssr: false, loading: () => <ImportFlowSkeleton /> },
);

export function NewStudySetPdfImportFlowDynamic(props: NewStudySetPdfImportFlowProps) {
  return <NewStudySetPdfImportFlow {...props} />;
}

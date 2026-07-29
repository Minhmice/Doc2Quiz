"use client";

/** @deprecated Replaced by UnifiedInputZone — kept for reference only. */

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useStudySetNewImportStep } from "@/components/edit/new/import/StudySetNewImportStepContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createStudySet } from "@/lib/client/studySetDb";
import type { StudyContentKind } from "@/types/studySet";

export type NewStudySetTextImportFlowProps = Readonly<{
  contentKind: StudyContentKind;
  pageHeading: string;
  pageSubcopy: string;
  getPostCreateHref: (studySetId: string) => string;
}>;

async function readTextFile(file: File): Promise<string> {
  return file.text();
}

export function NewStudySetTextImportFlow({
  contentKind,
  pageHeading,
  pageSubcopy,
  getPostCreateHref,
}: NewStudySetTextImportFlowProps) {
  const router = useRouter();
  const { setStep } = useStudySetNewImportStep();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const onCreate = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      toast.error("Paste or upload text before continuing.");
      return;
    }

    setBusy(true);
    setStep("read");
    try {
      const title =
        contentKind === "flashcards" ? "New flip study" : "New practice set";
      const studySetId = await createStudySet({
        title,
        extractedText: trimmed,
        contentKind,
      });
      setStep("generate");
      router.push(getPostCreateHref(studySetId));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not create study set.";
      toast.error(message);
      setStep("upload");
    } finally {
      setBusy(false);
    }
  }, [contentKind, getPostCreateHref, router, setStep, text]);

  const onTextFile = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) {
        return;
      }
      if (!file.name.toLowerCase().endsWith(".txt") && file.type !== "text/plain") {
        toast.error("Only plain .txt files are supported for now.");
        return;
      }
      try {
        const fileText = await readTextFile(file);
        setText(fileText);
      } catch {
        toast.error("Could not read the text file.");
      }
    },
    [],
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-8 sm:px-6">
      <header className="mb-8 max-w-2xl">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {pageHeading}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
          {pageSubcopy}
        </p>
      </header>

      <div className="space-y-4 rounded-xl border border-border/50 bg-card/60 p-5 shadow-sm">
        <label className="block space-y-2">
          <span className="font-label text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Source text
          </span>
          <Textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Paste your notes, article, or study material here…"
            className="min-h-[280px] resize-y font-mono text-sm leading-relaxed"
            disabled={busy}
          />
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/40">
            <input
              type="file"
              accept=".txt,text/plain"
              className="sr-only"
              disabled={busy}
              onChange={onTextFile}
            />
            Upload .txt
          </label>
          <Button type="button" onClick={() => void onCreate()} disabled={busy}>
            {busy ? "Creating…" : "Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}

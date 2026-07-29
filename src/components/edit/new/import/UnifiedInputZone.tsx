"use client";

import { useCallback, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { IngestProgressCard } from "@/components/edit/new/import/IngestProgressCard";
import { useLocale } from "@/components/locale/LocaleProvider";
import { useStudySetNewImportStep } from "@/components/edit/new/import/StudySetNewImportStepContext";
import { UploadBox } from "@/components/upload/UploadBox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  ingestStudySetSource,
  type IngestUiStep,
} from "@/lib/client/ingestStudySet";
import {
  formatBytesForError,
  MAX_UPLOAD_BYTES_BY_MIME,
  SUPPORTED_MIME_TYPES,
  validateFileUpload,
  validatePasteInput,
  validateYoutubeUrl,
} from "@/lib/pipeline/validation";
import type { StudyContentKind } from "@/types/studySet";

const FILE_ACCEPT = [
  ".pdf",
  ".docx",
  ".pptx",
  ".xlsx",
  ".xls",
  ".jpg",
  ".jpeg",
  ".png",
  ".wav",
  ".mp3",
  ".html",
  ".htm",
  ".csv",
  ".json",
  ".xml",
  ".txt",
  ...SUPPORTED_MIME_TYPES,
].join(",");

export type UnifiedInputZoneProps = Readonly<{
  contentKind: StudyContentKind;
  pageHeading: string;
  pageSubcopy: string;
  getPostIngestHref: (studySetId: string) => string;
}>;

type InputTab = "file" | "paste" | "youtube";

export function UnifiedInputZone({
  contentKind,
  pageHeading,
  pageSubcopy,
  getPostIngestHref,
}: UnifiedInputZoneProps) {
  const router = useRouter();
  const { messages } = useLocale();
  const copy = messages.workflows.import;
  const { setStep } = useStudySetNewImportStep();
  const [tab, setTab] = useState<InputTab>("file");
  const [file, setFile] = useState<File | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [ingestStep, setIngestStep] = useState<IngestUiStep>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [technicalDetails, setTechnicalDetails] = useState<string[]>([]);

  const busy = ingestStep !== "idle" && ingestStep !== "error";

  const hasValidInput = useMemo(() => {
    if (tab === "file") {
      return file !== null;
    }
    if (tab === "paste") {
      return validatePasteInput(pasteText) === null;
    }
    return validateYoutubeUrl(youtubeUrl) === null;
  }, [file, pasteText, tab, youtubeUrl]);

  const onConvert = useCallback(async () => {
    if (tab === "file" && !file) {
      toast.error(
        copy.missingInput,
      );
      return;
    }
    if (tab === "paste") {
      const pasteError = validatePasteInput(pasteText);
      if (pasteError) {
        toast.error(pasteError);
        return;
      }
    }
    if (tab === "youtube") {
      const urlError = validateYoutubeUrl(youtubeUrl);
      if (urlError) {
        toast.error(urlError);
        return;
      }
    }
    if (tab === "file" && file) {
      const fileError = validateFileUpload(file.type, file.size);
      if (fileError) {
        const limit = MAX_UPLOAD_BYTES_BY_MIME[
          file.type as keyof typeof MAX_UPLOAD_BYTES_BY_MIME
        ];
        toast.error(
          limit
            ? `${file.name} is too large. Maximum size for this type is ${formatBytesForError(limit)}.`
            : copy.unsupportedFile,
        );
        return;
      }
    }

    setErrorMessage(null);
    setTechnicalDetails([]);
    setIngestStep("validating");
    setStep("read");

    const input =
      tab === "file" && file
        ? { kind: "file" as const, file }
        : tab === "paste"
          ? { kind: "paste" as const, text: pasteText.trim() }
          : { kind: "youtube" as const, url: youtubeUrl.trim() };

    try {
      const studySetId = await ingestStudySetSource({
        contentKind,
        input,
        onStep: (step) => {
          setIngestStep(step);
          if (step === "validating" || step === "uploading" || step === "converting") {
            setStep("read");
          }
          if (step === "done") {
            setStep("generate");
          }
          if (step === "error") {
            setStep("upload");
          }
        },
      });

      setTechnicalDetails([
        `Study set: ${studySetId}`,
        `Input: ${tab}`,
        `Pipeline stage: raw`,
      ]);
      router.push(getPostIngestHref(studySetId));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : copy.fallbackError;
      setErrorMessage(message);
      setIngestStep("error");
      setStep("upload");
      toast.error(message);
      setIngestStep("idle");
    }
  }, [
    contentKind,
    copy,
    file,
    getPostIngestHref,
    pasteText,
    router,
    setStep,
    tab,
    youtubeUrl,
  ]);

  const showProgress =
    ingestStep === "validating" ||
    ingestStep === "uploading" ||
    ingestStep === "converting";

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-20 pt-10 sm:px-6 sm:pt-14 lg:px-8">
      <header className="d2q-import-enter mb-8 max-w-3xl" style={{ "--i": 0 } as CSSProperties}>
        <p className="mb-3 font-label text-xs font-bold tracking-[0.16em] text-primary">
          {copy.eyebrow}
        </p>
        <h1 className="font-display text-balance text-[clamp(2rem,5vw,3.5rem)] font-extrabold leading-[1.04] tracking-[-0.03em] text-foreground">
          {pageHeading}
        </h1>
        <p className="mt-4 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
          {pageSubcopy}
        </p>
      </header>

      {showProgress ? (
        <IngestProgressCard
          step={ingestStep}
          showUploadStep={tab === "file"}
          technicalDetails={technicalDetails}
        />
      ) : (
        <div
          className="d2q-import-enter d2q-import-panel rounded-2xl border border-border/60 bg-card p-6 shadow-sm sm:p-8"
          style={{ "--i": 1 } as CSSProperties}
        >
          <Tabs value={tab} onValueChange={(value) => setTab(value as InputTab)}>
            <TabsList variant="line" className="mb-6 w-full justify-start gap-3 border-b border-border/50">
              <TabsTrigger value="file" className="d2q-import-tab font-label text-xs font-bold uppercase tracking-widest">
                {copy.file}
              </TabsTrigger>
              <TabsTrigger value="paste" className="d2q-import-tab font-label text-xs font-bold uppercase tracking-widest">
                {copy.paste}
              </TabsTrigger>
              <TabsTrigger value="youtube" className="d2q-import-tab font-label text-xs font-bold uppercase tracking-widest">
                YouTube
              </TabsTrigger>
            </TabsList>

            <TabsContent value="file" className="space-y-4">
              <UploadBox
                accept={FILE_ACCEPT}
                disabled={busy}
                onFileSelected={setFile}
              />
            </TabsContent>

            <TabsContent value="paste" className="space-y-4">
              <label className="block space-y-2">
                <span className="font-label text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
                  {copy.sourceText}
                </span>
                <Textarea
                  value={pasteText}
                  onChange={(event) => setPasteText(event.target.value)}
                  placeholder={copy.pastePlaceholder}
                  className="min-h-[280px] resize-y font-mono text-sm leading-relaxed"
                  disabled={busy}
                />
              </label>
            </TabsContent>

            <TabsContent value="youtube" className="space-y-4">
              <label className="block space-y-2">
                <span className="font-label text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
                  YouTube URL
                </span>
                <Input
                  type="url"
                  autoComplete="off"
                  value={youtubeUrl}
                  onChange={(event) => setYoutubeUrl(event.target.value)}
                  placeholder="https://www.youtube.com/watch?v=…"
                  disabled={busy}
                />
                <p className="text-sm text-muted-foreground">
                  {copy.youtubeHelp}
                </p>
              </label>
            </TabsContent>
          </Tabs>

          <div className="mt-6 flex justify-end">
            <Button
              type="button"
              onClick={() => void onConvert()}
              disabled={busy || !hasValidInput}
              className="d2q-import-cta h-11 w-full font-heading text-base font-extrabold sm:w-auto"
            >
              {busy ? copy.converting : copy.convert}
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}

"use client";

import type { ChangeEvent } from "react";
import { Label } from "@/components/ui/label";

type Props = {
  attachCheckboxId: string;
  ocrCheckboxId: string;
  attachPageImage: boolean;
  enableOcr: boolean;
  onAttachChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onOcrChange: (e: ChangeEvent<HTMLInputElement>) => void;
};

export function AiParsePreferenceToggles({
  attachCheckboxId,
  ocrCheckboxId,
  attachPageImage,
  enableOcr,
  onAttachChange,
  onOcrChange,
}: Props) {
  return (
    <>
      <div className="space-y-2 rounded-lg border border-border bg-muted/30 px-4 py-3">
        <div className="flex cursor-pointer items-start gap-3">
          <input
            id={attachCheckboxId}
            type="checkbox"
            className="mt-1 size-4 shrink-0 cursor-pointer rounded border-input accent-primary"
            checked={attachPageImage}
            onChange={onAttachChange}
          />
          <div className="min-w-0 space-y-1">
            <Label
              htmlFor={attachCheckboxId}
              className="cursor-pointer text-sm font-medium leading-none text-foreground"
            >
              Attach page image to parsed questions
            </Label>
            <p className="text-sm text-muted-foreground">
              Each parsed question will keep a reference image from its source PDF
              page.
            </p>
          </div>
        </div>
      </div>
      <div className="space-y-2 rounded-lg border border-border bg-muted/30 px-4 py-3">
        <div className="flex cursor-pointer items-start gap-3">
          <input
            id={ocrCheckboxId}
            type="checkbox"
            className="mt-1 size-4 shrink-0 cursor-pointer rounded border-input accent-primary"
            checked={enableOcr}
            onChange={onOcrChange}
          />
          <div className="min-w-0 space-y-1">
            <Label
              htmlFor={ocrCheckboxId}
              className="cursor-pointer text-sm font-medium leading-none text-foreground"
            >
              Run OCR before vision parse
            </Label>
            <p className="text-sm text-muted-foreground">
              Extracts page text and layout into local storage for the OCR inspector
              and future mapping. OCR errors never block vision parsing.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

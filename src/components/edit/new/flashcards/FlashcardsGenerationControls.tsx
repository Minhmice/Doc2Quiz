"use client";

import { useId } from "react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type FlashcardGenerationConfig,
  type FlashcardFocusMode,
  type FlashcardLearningDepth,
} from "@/types/flashcardGeneration";
import { cn } from "@/lib/utils";

export type FlashcardsGenerationControlsProps = {
  value: FlashcardGenerationConfig;
  onChange: (next: FlashcardGenerationConfig) => void;
  disabled?: boolean;
  className?: string;
};

const DEPTH_OPTIONS: { value: FlashcardLearningDepth; label: string }[] = [
  { value: "quick_recall", label: "Quick recall" },
  { value: "standard", label: "Standard" },
  { value: "deep", label: "Deep" },
];

const FOCUS_OPTIONS: { value: FlashcardFocusMode; label: string }[] = [
  { value: "definitions", label: "Definitions" },
  { value: "key_points", label: "Key points" },
  { value: "formulas", label: "Formulas & notation" },
  { value: "processes", label: "Processes & steps" },
  { value: "comparisons", label: "Comparisons" },
  { value: "mixed", label: "Mixed" },
];

export function FlashcardsGenerationControls({
  value,
  onChange,
  disabled = false,
  className,
}: FlashcardsGenerationControlsProps) {
  const targetModeId = useId();
  const sliderId = useId();
  const countAuto = value.targetCount === "auto";
  const countNumber =
    typeof value.targetCount === "number" ? value.targetCount : 24;

  return (
    <div
      className={cn(
        "space-y-4 rounded-lg border border-border bg-muted/20 px-3 py-3 sm:px-4",
        className,
      )}
    >
      <p className="text-sm text-muted-foreground">
        Flashcards capture <span className="font-medium text-foreground">theory</span>{" "}
        (concepts, definitions, relationships). The quiz flow is for{" "}
        <span className="font-medium text-foreground">multiple-choice questions</span>.
      </p>

      <div className="space-y-2">
        <Label id={targetModeId} className="text-sm font-medium text-foreground">
          Card count target
        </Label>
        <RadioGroup
          className="flex flex-wrap gap-4"
          value={countAuto ? "auto" : "fixed"}
          onValueChange={(v) => {
            if (v === "auto") {
              onChange({ ...value, targetCount: "auto" });
            } else {
              onChange({
                ...value,
                targetCount:
                  typeof value.targetCount === "number"
                    ? value.targetCount
                    : 24,
              });
            }
          }}
          disabled={disabled}
          aria-labelledby={targetModeId}
        >
          <Label
            htmlFor={`${targetModeId}-auto`}
            className="flex cursor-pointer items-center gap-2 text-sm"
          >
            <RadioGroupItem id={`${targetModeId}-auto`} value="auto" disabled={disabled} />
            Auto
          </Label>
          <Label
            htmlFor={`${targetModeId}-fixed`}
            className="flex cursor-pointer items-center gap-2 text-sm"
          >
            <RadioGroupItem id={`${targetModeId}-fixed`} value="fixed" disabled={disabled} />
            Set range (10–60)
          </Label>
        </RadioGroup>
        {!countAuto ? (
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between gap-3">
              <Label id={sliderId} className="text-sm text-muted-foreground">
                Target cards (approx.)
              </Label>
              <span className="tabular-nums text-sm font-medium text-foreground">
                {countNumber}
              </span>
            </div>
            <input
              id={sliderId}
              type="range"
              min={10}
              max={60}
              step={1}
              value={countNumber}
              disabled={disabled}
              className={cn(
                "h-2 w-full cursor-pointer appearance-none rounded-full bg-primary/20 accent-primary disabled:cursor-not-allowed disabled:opacity-50",
              )}
              onChange={(e) =>
                onChange({
                  ...value,
                  targetCount: Number(e.target.value),
                })
              }
            />
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">
            Learning depth
          </Label>
          <Select
            value={value.learningDepth}
            onValueChange={(v) =>
              onChange({
                ...value,
                learningDepth: v as FlashcardLearningDepth,
              })
            }
            disabled={disabled}
          >
            <SelectTrigger className="cursor-pointer w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DEPTH_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} className="cursor-pointer">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">Focus</Label>
          <Select
            value={value.focusMode}
            onValueChange={(v) =>
              onChange({
                ...value,
                focusMode: v as FlashcardFocusMode,
              })
            }
            disabled={disabled}
          >
            <SelectTrigger className="cursor-pointer w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FOCUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} className="cursor-pointer">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { deleteMedia, putMediaBlob } from "@/lib/db/studySetDb";
import type { Question } from "@/types/question";
import {
  questionEditorSchema,
  type QuestionEditorFormValues,
} from "@/lib/validations/question";
import { StoredImage } from "@/components/media/StoredImage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Field,
  FieldContent,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";

const MAX_IMAGE_BYTES = 1_500_000;

function valuesFromQuestion(q: Question): QuestionEditorFormValues {
  return {
    question: q.question,
    option0: q.options[0],
    option1: q.options[1],
    option2: q.options[2],
    option3: q.options[3],
    correctIndex: q.correctIndex,
  };
}

export type QuestionEditorProps = {
  studySetId: string;
  question: Question;
  onSave: (q: Question) => void | Promise<void>;
  onCancel: () => void;
};

export function QuestionEditor({
  studySetId,
  question,
  onSave,
  onCancel,
}: QuestionEditorProps) {
  const [questionImageId, setQuestionImageId] = useState<
    string | undefined
  >(question.questionImageId);
  const [optionImageIds, setOptionImageIds] = useState<
    [string | undefined, string | undefined, string | undefined, string | undefined]
  >(question.optionImageIds ?? [undefined, undefined, undefined, undefined]);
  const [imageError, setImageError] = useState<string | null>(null);

  const form = useForm<QuestionEditorFormValues>({
    resolver: zodResolver(questionEditorSchema),
    defaultValues: valuesFromQuestion(question),
    mode: "onBlur",
  });

  useEffect(() => {
    form.reset(valuesFromQuestion(question));
    setQuestionImageId(question.questionImageId);
    setOptionImageIds(
      question.optionImageIds ?? [
        undefined,
        undefined,
        undefined,
        undefined,
      ],
    );
    setImageError(null);
  }, [question, form]);

  const pickImage = useCallback(
    async (file: File | undefined) => {
      setImageError(null);
      if (!file) {
        return;
      }
      if (!file.type.startsWith("image/")) {
        setImageError("Choose an image file (PNG, JPEG, WebP, …).");
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setImageError(
          `Image too large (max ${Math.round(MAX_IMAGE_BYTES / 1024)} KB).`,
        );
        return;
      }
      return putMediaBlob(studySetId, file);
    },
    [studySetId],
  );

  const handleQuestionImage = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      const id = await pickImage(file);
      if (!id) {
        return;
      }
      if (questionImageId) {
        await deleteMedia(questionImageId);
      }
      setQuestionImageId(id);
    },
    [pickImage, questionImageId],
  );

  const clearQuestionImage = useCallback(async () => {
    if (questionImageId) {
      await deleteMedia(questionImageId);
    }
    setQuestionImageId(undefined);
  }, [questionImageId]);

  const handleOptionImage = useCallback(
    async (index: 0 | 1 | 2 | 3, e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      const id = await pickImage(file);
      if (!id) {
        return;
      }
      const prev = optionImageIds[index];
      if (prev) {
        await deleteMedia(prev);
      }
      setOptionImageIds((o) => {
        const next = [...o] as typeof o;
        next[index] = id;
        return next;
      });
    },
    [pickImage, optionImageIds],
  );

  const clearOptionImage = useCallback(
    async (index: 0 | 1 | 2 | 3) => {
      const prev = optionImageIds[index];
      if (prev) {
        await deleteMedia(prev);
      }
      setOptionImageIds((o) => {
        const next = [...o] as typeof o;
        next[index] = undefined;
        return next;
      });
    },
    [optionImageIds],
  );

  const submit = form.handleSubmit((data) => {
    const base: Question = {
      ...question,
      question: data.question.trim(),
      options: [
        data.option0.trim(),
        data.option1.trim(),
        data.option2.trim(),
        data.option3.trim(),
      ] as Question["options"],
      correctIndex: data.correctIndex,
    };
    if (questionImageId) {
      base.questionImageId = questionImageId;
    } else {
      delete base.questionImageId;
      delete base.sourceImageMediaId;
    }
    if (optionImageIds.some(Boolean)) {
      base.optionImageIds = optionImageIds;
    } else {
      delete base.optionImageIds;
    }
    void onSave(base);
    toast.success("Question saved");
  });

  return (
    <form
      className="mt-4 space-y-4 border-t border-border pt-4"
      onSubmit={submit}
    >
      {imageError ? (
        <p className="text-sm font-medium text-destructive" role="alert">
          {imageError}
        </p>
      ) : null}

      <FieldSet>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`q-stem-${question.id}`}>Question</FieldLabel>
            <FieldContent>
              <Textarea
                id={`q-stem-${question.id}`}
                rows={3}
                {...form.register("question")}
                aria-invalid={Boolean(form.formState.errors.question)}
              />
              <FieldError errors={[form.formState.errors.question]} />
            </FieldContent>
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            <Label className="cursor-pointer text-xs font-medium text-primary underline">
              Add question image
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => void handleQuestionImage(e)}
              />
            </Label>
            {questionImageId ? (
              <>
                <StoredImage
                  mediaId={questionImageId}
                  alt=""
                  className="mt-1"
                />
                <Button
                  type="button"
                  variant="link"
                  size="xs"
                  className="h-auto px-0 text-destructive"
                  onClick={() => void clearQuestionImage()}
                >
                  Remove image
                </Button>
              </>
            ) : null}
          </div>
        </FieldGroup>

        <Separator />

        {(["A", "B", "C", "D"] as const).map((label, i) => {
          const name = `option${i}` as
            | "option0"
            | "option1"
            | "option2"
            | "option3";
          const idx = i as 0 | 1 | 2 | 3;
          const oid = optionImageIds[idx];
          const err = form.formState.errors[name];
          return (
            <Field key={label}>
              <FieldLabel htmlFor={`q-opt-${question.id}-${i}`}>
                {label}
              </FieldLabel>
              <FieldContent>
                <Input
                  id={`q-opt-${question.id}-${i}`}
                  {...form.register(name)}
                  aria-invalid={Boolean(err)}
                />
                <FieldError errors={[err]} />
              </FieldContent>
              <div className="flex flex-wrap items-center gap-2">
                <Label className="cursor-pointer text-xs font-medium text-primary underline">
                  Image for {label}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => void handleOptionImage(idx, e)}
                  />
                </Label>
                {oid ? (
                  <>
                    <StoredImage mediaId={oid} alt="" />
                    <Button
                      type="button"
                      variant="link"
                      size="xs"
                      className="h-auto px-0 text-destructive"
                      onClick={() => void clearOptionImage(idx)}
                    >
                      Remove
                    </Button>
                  </>
                ) : null}
              </div>
            </Field>
          );
        })}

        <Field>
          <FieldTitle>Correct answer</FieldTitle>
          <FieldContent>
            <Controller
              control={form.control}
              name="correctIndex"
              render={({ field }) => (
                <RadioGroup
                  value={String(field.value)}
                  onValueChange={(v) =>
                    field.onChange(Number(v) as 0 | 1 | 2 | 3)
                  }
                  className="flex flex-col gap-2 sm:flex-row sm:flex-wrap"
                >
                  {([0, 1, 2, 3] as const).map((i) => (
                    <Label
                      key={i}
                      htmlFor={`q-correct-${question.id}-${i}`}
                      className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground"
                    >
                      <RadioGroupItem
                        value={String(i)}
                        id={`q-correct-${question.id}-${i}`}
                      />
                      {String.fromCharCode(65 + i)}
                    </Label>
                  ))}
                </RadioGroup>
              )}
            />
            <FieldError errors={[form.formState.errors.correctIndex]} />
          </FieldContent>
        </Field>
      </FieldSet>

      <div className="flex flex-wrap gap-2">
        <Button type="submit">Save</Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

"use client";

import { useCallback, useEffect } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { Question } from "@/types/question";
import {
  questionEditorSchema,
  type QuestionEditorFormValues,
} from "@/lib/validations/question";
import { useLocale } from "@/components/locale/LocaleProvider";
import { Button } from "@/components/buttons/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { MathText } from "@/components/math/MathText";
import { Label } from "@/components/ui/label";

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
  question,
  onSave,
  onCancel,
}: QuestionEditorProps) {
  const { messages } = useLocale();
  const copy = messages.workflows.review;
  const form = useForm<QuestionEditorFormValues>({
    resolver: zodResolver(questionEditorSchema),
    defaultValues: valuesFromQuestion(question),
    mode: "onBlur",
  });

  const watchQuestion = useWatch({ control: form.control, name: "question" });
  const watchOpt0 = useWatch({ control: form.control, name: "option0" });
  const watchOpt1 = useWatch({ control: form.control, name: "option1" });
  const watchOpt2 = useWatch({ control: form.control, name: "option2" });
  const watchOpt3 = useWatch({ control: form.control, name: "option3" });

  useEffect(() => {
    form.reset(valuesFromQuestion(question));
  }, [question, form]);

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
    void onSave(base);
    toast.success(copy.questionSaved);
  });

  return (
    <form
      className="mt-4 space-y-4 border-t border-border pt-4"
      onSubmit={submit}
    >
      <FieldSet>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`q-stem-${question.id}`}>{copy.question}</FieldLabel>
            <FieldContent>
              <Textarea
                id={`q-stem-${question.id}`}
                rows={3}
                {...form.register("question")}
                aria-invalid={Boolean(form.formState.errors.question)}
              />
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
                <p className="text-xs font-medium text-muted-foreground">{copy.preview}</p>
                <MathText
                  source={watchQuestion ?? ""}
                  debounceMs={400}
                  className="mt-1 text-sm text-card-foreground"
                />
              </div>
              <FieldError errors={[form.formState.errors.question]} />
            </FieldContent>
          </Field>
        </FieldGroup>

        <Separator />

        {(["A", "B", "C", "D"] as const).map((label, i) => {
          const name = `option${i}` as
            | "option0"
            | "option1"
            | "option2"
            | "option3";
          const err = form.formState.errors[name];
          const optPreview = [watchOpt0, watchOpt1, watchOpt2, watchOpt3][i];
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
                <div className="mt-2 rounded-md border border-border bg-muted/30 px-3 py-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    {copy.preview}
                  </p>
                  <MathText
                    source={optPreview ?? ""}
                    debounceMs={400}
                    className="mt-1 text-sm text-card-foreground"
                  />
                </div>
                <FieldError errors={[err]} />
              </FieldContent>
            </Field>
          );
        })}

        <Field>
          <FieldTitle>{copy.correctAnswer}</FieldTitle>
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
        <Button type="submit">{copy.save}</Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          {copy.cancel}
        </Button>
      </div>
    </form>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  clearKeyForProvider,
  getKeyForProvider,
  getModelForProvider,
  getUrlForProvider,
  setKeyForProvider,
  setModelForProvider,
  setUrlForProvider,
} from "@/lib/ai/storage";
import { migrateForwardSettingsFromLegacy } from "@/lib/ai/forwardSettings";
import type { AiProvider } from "@/types/question";
import {
  defaultForwardEndpointHint,
  defaultForwardModelPlaceholder,
  testAiConnection,
  testAiVisionConnection,
} from "@/lib/ai/testConnection";
import { dispatchAiConfigChanged } from "@/lib/ai/aiReachability";
import {
  aiSettingsSchema,
  type AiSettingsFormValues,
} from "@/lib/validations/aiSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { cn } from "@/lib/utils";

const PLACEHOLDER_PROVIDER: AiProvider = "openai";

export function AiProviderForm() {
  const [showKey, setShowKey] = useState(false);
  const testAbortRef = useRef<AbortController | null>(null);
  const visionTestAbortRef = useRef<AbortController | null>(null);

  const form = useForm<AiSettingsFormValues>({
    resolver: zodResolver(aiSettingsSchema),
    defaultValues: {
      baseUrl: "",
      modelId: "",
      key: "",
    },
    mode: "onChange",
  });

  useEffect(() => {
    migrateForwardSettingsFromLegacy();
    form.reset({
      baseUrl: getUrlForProvider(PLACEHOLDER_PROVIDER),
      modelId: getModelForProvider(PLACEHOLDER_PROVIDER),
      key: getKeyForProvider(PLACEHOLDER_PROVIDER),
    });
  }, [form]);

  const invalidateConnection = useCallback(() => {
    testAbortRef.current?.abort();
    testAbortRef.current = null;
    visionTestAbortRef.current?.abort();
    visionTestAbortRef.current = null;
  }, []);

  const handleClearKey = useCallback(() => {
    invalidateConnection();
    clearKeyForProvider(PLACEHOLDER_PROVIDER);
    form.setValue("key", "");
    form.setValue("baseUrl", "");
    form.setValue("modelId", "");
    dispatchAiConfigChanged();
  }, [form, invalidateConnection]);

  const handleTestConnection = useCallback(async () => {
    const ok = await form.trigger();
    if (!ok) {
      toast.error("Fix form errors before testing.");
      return;
    }
    const apiKey = form.getValues("key").trim();
    if (!apiKey) {
      toast.error("Enter an API key first.");
      return;
    }
    visionTestAbortRef.current?.abort();
    visionTestAbortRef.current = null;
    testAbortRef.current?.abort();
    const controller = new AbortController();
    testAbortRef.current = controller;
    const toastId = toast.loading("Testing connection…");
    try {
      const result = await testAiConnection({
        baseUrl: form.getValues("baseUrl"),
        apiKey,
        modelId: form.getValues("modelId"),
        signal: controller.signal,
      });
      if (controller.signal.aborted) {
        return;
      }
      if (result.ok) {
        toast.success("Connection OK", { id: toastId });
      } else {
        toast.error(result.message, { id: toastId });
      }
    } finally {
      if (testAbortRef.current === controller) {
        testAbortRef.current = null;
      }
    }
  }, [form]);

  const handleTestVisionImage = useCallback(async () => {
    const ok = await form.trigger();
    if (!ok) {
      toast.error("Fix form errors before testing.");
      return;
    }
    const apiKey = form.getValues("key").trim();
    if (!apiKey) {
      toast.error("Enter an API key first.");
      return;
    }
    testAbortRef.current?.abort();
    testAbortRef.current = null;
    visionTestAbortRef.current?.abort();
    const controller = new AbortController();
    visionTestAbortRef.current = controller;
    const toastId = toast.loading("Testing vision…");
    try {
      const result = await testAiVisionConnection({
        baseUrl: form.getValues("baseUrl"),
        apiKey,
        modelId: form.getValues("modelId"),
        signal: controller.signal,
      });
      if (controller.signal.aborted) {
        return;
      }
      if (result.ok) {
        toast.success(
          result.replyPreview
            ? `Vision OK — ${result.replyPreview.slice(0, 80)}…`
            : "Vision OK",
          { id: toastId },
        );
      } else {
        toast.error(result.message, { id: toastId });
      }
    } finally {
      if (visionTestAbortRef.current === controller) {
        visionTestAbortRef.current = null;
      }
    }
  }, [form]);

  const baseUrlWatch = form.watch("baseUrl") ?? "";
  const hasKey = (form.watch("key") ?? "").trim().length > 0;
  const hasCustomBase = baseUrlWatch.trim().length > 0;
  const hasModelWhenNeeded = !hasCustomBase || (form.watch("modelId") ?? "").trim().length > 0;

  return (
    <section className="space-y-6" aria-labelledby="ai-settings-heading">
      <div>
        <h2
          id="ai-settings-heading"
          className="text-lg font-semibold tracking-tight text-foreground"
        >
          AI connection
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          One <strong className="font-medium text-foreground">OpenAI-compatible</strong>{" "}
          endpoint (Bearer). Stored in this browser only. Traffic uses{" "}
          <code className="rounded bg-muted px-1 text-foreground">
            /api/ai/forward
          </code>
          . See <code className="rounded bg-muted px-1 text-foreground">docs/BYOK-forward-only.md</code>.
        </p>
      </div>

      <Field>
        <FieldLabel
          htmlFor="ai-api-base-url"
          className="font-label text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
        >
          API base URL
        </FieldLabel>
        <FieldDescription>
          Full chat-completions URL, or leave blank to use the default OpenAI host.
        </FieldDescription>
        <FieldContent>
          <Input
            id="ai-api-base-url"
            type="url"
            autoComplete="off"
            spellCheck={false}
            className="rounded-none border-0 border-b-2 border-border bg-transparent px-0 shadow-none focus-visible:border-primary focus-visible:ring-0"
            placeholder={defaultForwardEndpointHint()}
            {...(() => {
              const { onChange, ...rest } = form.register("baseUrl");
              return {
                ...rest,
                onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                  void onChange(e);
                  setUrlForProvider(PLACEHOLDER_PROVIDER, e.target.value);
                  dispatchAiConfigChanged();
                  invalidateConnection();
                },
              };
            })()}
            aria-invalid={Boolean(form.formState.errors.baseUrl)}
          />
          <FieldError errors={[form.formState.errors.baseUrl]} />
        </FieldContent>
      </Field>

      <Field>
        <FieldLabel
          htmlFor="ai-model-id"
          className="font-label text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
        >
          Model id
        </FieldLabel>
        <FieldDescription>
          {hasCustomBase ? (
            <strong>Required</strong>
          ) : (
            <>Optional — blank uses a built-in default.</>
          )}
        </FieldDescription>
        <FieldContent>
          <Input
            id="ai-model-id"
            type="text"
            autoComplete="off"
            spellCheck={false}
            className="rounded-none border-0 border-b-2 border-border bg-transparent px-0 shadow-none focus-visible:border-primary focus-visible:ring-0"
            placeholder={defaultForwardModelPlaceholder()}
            {...(() => {
              const { onChange, ...rest } = form.register("modelId");
              return {
                ...rest,
                onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                  void onChange(e);
                  setModelForProvider(PLACEHOLDER_PROVIDER, e.target.value);
                  dispatchAiConfigChanged();
                  invalidateConnection();
                },
              };
            })()}
            aria-invalid={Boolean(form.formState.errors.modelId)}
          />
          <FieldError errors={[form.formState.errors.modelId]} />
        </FieldContent>
      </Field>

      <Field>
        <FieldLabel
          htmlFor="ai-api-key"
          className="font-label text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
        >
          API key
        </FieldLabel>
        <FieldContent>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
            <div className="relative min-w-0 flex-1">
              <Input
                id="ai-api-key"
                type={showKey ? "text" : "password"}
                autoComplete="off"
                spellCheck={false}
                className={cn(
                  "rounded-none border-0 border-b-2 border-border bg-transparent px-0 pr-16 shadow-none focus-visible:border-primary focus-visible:ring-0",
                )}
                {...(() => {
                  const { onChange, ...rest } = form.register("key");
                  return {
                    ...rest,
                    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                      void onChange(e);
                      setKeyForProvider(PLACEHOLDER_PROVIDER, e.target.value);
                      dispatchAiConfigChanged();
                      invalidateConnection();
                    },
                  };
                })()}
              />
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="absolute top-1/2 right-1 -translate-y-1/2"
                onClick={() => setShowKey((v) => !v)}
                aria-label={showKey ? "Hide API key" : "Show API key"}
              >
                {showKey ? "Hide" : "Show"}
              </Button>
            </div>
            <Button type="button" variant="outline" onClick={handleClearKey}>
              Clear
            </Button>
          </div>
          <FieldError errors={[form.formState.errors.key]} />
        </FieldContent>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            disabled={!hasKey || !hasModelWhenNeeded}
            onClick={() => void handleTestConnection()}
          >
            Test connection
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!hasKey || !hasModelWhenNeeded}
            onClick={() => void handleTestVisionImage()}
          >
            Test image input
          </Button>
          {hasKey ? (
            <Badge variant="secondary" className="text-emerald-600">
              Key set
            </Badge>
          ) : null}
        </div>
      </Field>
    </section>
  );
}

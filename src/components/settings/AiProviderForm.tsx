"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  clearKeyForProvider,
  clearModelForProvider,
  clearUrlForProvider,
  getKeyForProvider,
  getModelForProvider,
  getProvider,
  getUrlForProvider,
  setKeyForProvider,
  setModelForProvider,
  setProvider,
  setUrlForProvider,
} from "@/lib/ai/storage";
import {
  defaultEndpointHint,
  defaultModelPlaceholder,
  testAiConnection,
  testAiVisionConnection,
} from "@/lib/ai/testConnection";
import { dispatchAiConfigChanged } from "@/lib/ai/aiReachability";
import type { AiProvider } from "@/types/question";
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

export function AiProviderForm() {
  const [showKey, setShowKey] = useState(false);
  const testAbortRef = useRef<AbortController | null>(null);
  const visionTestAbortRef = useRef<AbortController | null>(null);

  const form = useForm<AiSettingsFormValues>({
    resolver: zodResolver(aiSettingsSchema),
    defaultValues: {
      provider: "openai",
      url: "",
      model: "",
      key: "",
    },
    mode: "onChange",
  });

  useEffect(() => {
    const p = getProvider();
    form.reset({
      provider: p,
      url: getUrlForProvider(p),
      model: getModelForProvider(p),
      key: getKeyForProvider(p),
    });
  }, [form]);

  const provider = form.watch("provider");

  const invalidateConnection = useCallback(() => {
    testAbortRef.current?.abort();
    testAbortRef.current = null;
    visionTestAbortRef.current?.abort();
    visionTestAbortRef.current = null;
  }, []);

  const selectProvider = useCallback(
    (p: AiProvider) => {
      invalidateConnection();
      setProvider(p);
      form.setValue("provider", p);
      form.setValue("url", getUrlForProvider(p));
      form.setValue("model", getModelForProvider(p));
      form.setValue("key", getKeyForProvider(p));
      void form.trigger();
      dispatchAiConfigChanged();
    },
    [form, invalidateConnection],
  );

  const handleClearKey = useCallback(() => {
    invalidateConnection();
    clearKeyForProvider(provider);
    clearUrlForProvider(provider);
    clearModelForProvider(provider);
    form.setValue("key", "");
    form.setValue("url", "");
    form.setValue("model", "");
    dispatchAiConfigChanged();
  }, [provider, form, invalidateConnection]);

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
        provider: form.getValues("provider"),
        apiUrl: form.getValues("url"),
        apiKey,
        model: form.getValues("model"),
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
    if (form.getValues("provider") === "anthropic") {
      toast.error("Switch to OpenAI or Custom to test image input.");
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
        provider: form.getValues("provider"),
        apiUrl: form.getValues("url"),
        apiKey,
        model: form.getValues("model"),
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

  const hasKey = (form.watch("key") ?? "").trim().length > 0;
  const hasCustomEndpoint =
    provider !== "custom" || (form.watch("url") ?? "").trim().length > 0;
  const hasCustomModel =
    provider !== "custom" || (form.watch("model") ?? "").trim().length > 0;

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
          OpenAI, Claude, or{" "}
          <strong className="font-medium text-foreground">Custom</strong>{" "}
          (OpenAI-compatible chat +{" "}
          <code className="rounded bg-muted px-1 text-foreground">Bearer</code>
          ). Stored in your browser only. Requests use this app&apos;s{" "}
          <code className="rounded bg-muted px-1 text-foreground">
            /api/ai/forward
          </code>{" "}
          route.
        </p>
      </div>

      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="AI provider"
      >
        {(["openai", "anthropic", "custom"] as const).map((p) => (
          <Button
            key={p}
            type="button"
            variant={provider === p ? "secondary" : "outline"}
            size="sm"
            className={cn(
              provider === p &&
                "ring-2 ring-primary/50 bg-primary/10 text-primary",
            )}
            onClick={() => selectProvider(p)}
          >
            {p === "openai"
              ? "OpenAI"
              : p === "anthropic"
                ? "Claude"
                : "Custom"}
          </Button>
        ))}
      </div>

      <Field>
        <FieldLabel htmlFor="ai-api-url">API endpoint URL</FieldLabel>
        <FieldDescription>
          {provider === "custom" ? (
            <>
              <strong>Required</strong> — base URL or full chat-completions URL.
            </>
          ) : provider === "openai" ? (
            <>Leave blank for default OpenAI, or paste a proxy / Azure URL.</>
          ) : (
            <>Leave blank for default Anthropic, or paste a compatible URL.</>
          )}
        </FieldDescription>
        <FieldContent>
          <Input
            id="ai-api-url"
            type="url"
            autoComplete="off"
            spellCheck={false}
            placeholder={defaultEndpointHint(provider)}
            {...(() => {
              const { onChange, ...rest } = form.register("url");
              return {
                ...rest,
                onChange: (
                  e: React.ChangeEvent<HTMLInputElement>,
                ) => {
                  void onChange(e);
                  setUrlForProvider(provider, e.target.value);
                  dispatchAiConfigChanged();
                  invalidateConnection();
                },
              };
            })()}
            aria-invalid={Boolean(form.formState.errors.url)}
          />
          <FieldError errors={[form.formState.errors.url]} />
        </FieldContent>
      </Field>

      <Field>
        <FieldLabel htmlFor="ai-model">Model</FieldLabel>
        <FieldDescription>
          {provider === "custom" ? (
            <strong>Required</strong>
          ) : (
            <>Optional — blank uses built-in default.</>
          )}
        </FieldDescription>
        <FieldContent>
          <Input
            id="ai-model"
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder={defaultModelPlaceholder(provider)}
            {...(() => {
              const { onChange, ...rest } = form.register("model");
              return {
                ...rest,
                onChange: (
                  e: React.ChangeEvent<HTMLInputElement>,
                ) => {
                  void onChange(e);
                  setModelForProvider(provider, e.target.value);
                  dispatchAiConfigChanged();
                  invalidateConnection();
                },
              };
            })()}
            aria-invalid={Boolean(form.formState.errors.model)}
          />
          <FieldError errors={[form.formState.errors.model]} />
        </FieldContent>
      </Field>

      <Field>
        <FieldLabel htmlFor="ai-api-key">
          API key
          {provider === "openai"
            ? " (OpenAI)"
            : provider === "anthropic"
              ? " (Anthropic)"
              : " (Bearer token)"}
        </FieldLabel>
        <FieldContent>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
            <div className="relative min-w-0 flex-1">
              <Input
                id="ai-api-key"
                type={showKey ? "text" : "password"}
                autoComplete="off"
                spellCheck={false}
                className="pr-16"
                {...(() => {
                  const { onChange, ...rest } = form.register("key");
                  return {
                    ...rest,
                    onChange: (
                      e: React.ChangeEvent<HTMLInputElement>,
                    ) => {
                      void onChange(e);
                      setKeyForProvider(provider, e.target.value);
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
            <Button
              type="button"
              variant="outline"
              onClick={handleClearKey}
            >
              Clear
            </Button>
          </div>
          <FieldError errors={[form.formState.errors.key]} />
        </FieldContent>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            disabled={
              !hasKey || !hasCustomEndpoint || !hasCustomModel
            }
            onClick={() => void handleTestConnection()}
          >
            Test connection
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={
              !hasKey ||
              !hasCustomEndpoint ||
              !hasCustomModel ||
              provider === "anthropic"
            }
            title={
              provider === "anthropic"
                ? "Switch to OpenAI or Custom to test image input."
                : undefined
            }
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

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

export function AiProviderForm() {
  const [provider, setProviderState] = useState<AiProvider>("openai");
  const [urlInput, setUrlInput] = useState("");
  const [modelInput, setModelInput] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [connectionValid, setConnectionValid] = useState(false);
  const [visionImageTestOk, setVisionImageTestOk] = useState(false);
  const [visionTestReply, setVisionTestReply] = useState<string | null>(null);
  const [testRunning, setTestRunning] = useState(false);
  const [visionTestRunning, setVisionTestRunning] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [visionTestError, setVisionTestError] = useState<string | null>(null);

  const testAbortRef = useRef<AbortController | null>(null);
  const visionTestAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const p = getProvider();
    setProviderState(p);
    setUrlInput(getUrlForProvider(p));
    setModelInput(getModelForProvider(p));
    setKeyInput(getKeyForProvider(p));
  }, []);

  const hasKey = keyInput.trim().length > 0;
  const hasCustomEndpoint =
    provider !== "custom" || urlInput.trim().length > 0;
  const hasCustomModel =
    provider !== "custom" || modelInput.trim().length > 0;

  const invalidateConnection = useCallback(() => {
    setConnectionValid(false);
    setVisionImageTestOk(false);
    setVisionTestReply(null);
    setTestError(null);
    setVisionTestError(null);
    testAbortRef.current?.abort();
    testAbortRef.current = null;
    visionTestAbortRef.current?.abort();
    visionTestAbortRef.current = null;
  }, []);

  const selectProvider = useCallback(
    (p: AiProvider) => {
      invalidateConnection();
      setProvider(p);
      setProviderState(p);
      setUrlInput(getUrlForProvider(p));
      setModelInput(getModelForProvider(p));
      setKeyInput(getKeyForProvider(p));
      dispatchAiConfigChanged();
    },
    [invalidateConnection],
  );

  const handleUrlChange = useCallback(
    (value: string) => {
      invalidateConnection();
      setUrlInput(value);
      setUrlForProvider(provider, value);
      dispatchAiConfigChanged();
    },
    [provider, invalidateConnection],
  );

  const handleKeyChange = useCallback(
    (value: string) => {
      invalidateConnection();
      setKeyInput(value);
      setKeyForProvider(provider, value);
      dispatchAiConfigChanged();
    },
    [provider, invalidateConnection],
  );

  const handleModelChange = useCallback(
    (value: string) => {
      invalidateConnection();
      setModelInput(value);
      setModelForProvider(provider, value);
      dispatchAiConfigChanged();
    },
    [provider, invalidateConnection],
  );

  const handleClearKey = useCallback(() => {
    invalidateConnection();
    clearKeyForProvider(provider);
    clearUrlForProvider(provider);
    clearModelForProvider(provider);
    setKeyInput("");
    setUrlInput("");
    setModelInput("");
    dispatchAiConfigChanged();
  }, [provider, invalidateConnection]);

  const handleTestConnection = useCallback(async () => {
    setTestError(null);
    visionTestAbortRef.current?.abort();
    visionTestAbortRef.current = null;
    const apiKey = keyInput.trim();
    if (!apiKey) {
      setTestError("Enter an API key first.");
      return;
    }
    testAbortRef.current?.abort();
    const controller = new AbortController();
    testAbortRef.current = controller;
    setTestRunning(true);
    setConnectionValid(false);
    try {
      const result = await testAiConnection({
        provider,
        apiUrl: urlInput,
        apiKey,
        model: modelInput,
        signal: controller.signal,
      });
      if (controller.signal.aborted) {
        return;
      }
      if (result.ok) {
        setConnectionValid(true);
        setTestError(null);
      } else {
        setConnectionValid(false);
        setTestError(result.message);
      }
    } finally {
      if (testAbortRef.current === controller) {
        testAbortRef.current = null;
      }
      setTestRunning(false);
    }
  }, [provider, urlInput, keyInput, modelInput]);

  const handleTestVisionImage = useCallback(async () => {
    setVisionTestError(null);
    testAbortRef.current?.abort();
    testAbortRef.current = null;
    const apiKey = keyInput.trim();
    if (!apiKey) {
      setVisionTestError("Enter an API key first.");
      return;
    }
    visionTestAbortRef.current?.abort();
    const controller = new AbortController();
    visionTestAbortRef.current = controller;
    setVisionTestRunning(true);
    setVisionImageTestOk(false);
    setVisionTestReply(null);
    try {
      const result = await testAiVisionConnection({
        provider,
        apiUrl: urlInput,
        apiKey,
        model: modelInput,
        signal: controller.signal,
      });
      if (controller.signal.aborted) {
        return;
      }
      if (result.ok) {
        setVisionImageTestOk(true);
        setVisionTestReply(result.replyPreview);
        setVisionTestError(null);
      } else {
        setVisionImageTestOk(false);
        setVisionTestReply(null);
        setVisionTestError(result.message);
      }
    } finally {
      if (visionTestAbortRef.current === controller) {
        visionTestAbortRef.current = null;
      }
      setVisionTestRunning(false);
    }
  }, [provider, urlInput, keyInput, modelInput]);

  return (
    <section className="space-y-6" aria-labelledby="ai-settings-heading">
      <div>
        <h2
          id="ai-settings-heading"
          className="text-lg font-semibold tracking-tight text-[var(--d2q-text)]"
        >
          AI connection
        </h2>
        <p className="mt-1 text-sm text-[var(--d2q-muted)]">
          OpenAI, Claude, or <strong className="font-medium text-[var(--d2q-text)]">Custom</strong>{" "}
          (OpenAI-compatible chat +{" "}
          <code className="rounded bg-[var(--d2q-surface-elevated)] px-1 text-[var(--d2q-text)]">Bearer</code>). Stored
          in your browser only. Requests use this app&apos;s{" "}
          <code className="rounded bg-[var(--d2q-surface-elevated)] px-1 text-[var(--d2q-text)]">/api/ai/forward</code>{" "}
          route.
        </p>
      </div>

      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="AI provider"
      >
        <button
          type="button"
          onClick={() => selectProvider("openai")}
          className={`cursor-pointer rounded-lg border px-4 py-2 text-sm font-medium transition-colors duration-200 ${
            provider === "openai"
              ? "border-[var(--d2q-accent)] bg-[var(--d2q-accent-muted)] text-[var(--d2q-accent-hover)]"
              : "border-[var(--d2q-border)] bg-[var(--d2q-surface-elevated)] text-[var(--d2q-muted)] hover:border-[var(--d2q-border-strong)] hover:bg-[var(--d2q-surface)] hover:text-[var(--d2q-text)]"
          }`}
        >
          OpenAI
        </button>
        <button
          type="button"
          onClick={() => selectProvider("anthropic")}
          className={`cursor-pointer rounded-lg border px-4 py-2 text-sm font-medium transition-colors duration-200 ${
            provider === "anthropic"
              ? "border-[var(--d2q-accent)] bg-[var(--d2q-accent-muted)] text-[var(--d2q-accent-hover)]"
              : "border-[var(--d2q-border)] bg-[var(--d2q-surface-elevated)] text-[var(--d2q-muted)] hover:border-[var(--d2q-border-strong)] hover:bg-[var(--d2q-surface)] hover:text-[var(--d2q-text)]"
          }`}
        >
          Claude
        </button>
        <button
          type="button"
          onClick={() => selectProvider("custom")}
          className={`cursor-pointer rounded-lg border px-4 py-2 text-sm font-medium transition-colors duration-200 ${
            provider === "custom"
              ? "border-[var(--d2q-accent)] bg-[var(--d2q-accent-muted)] text-[var(--d2q-accent-hover)]"
              : "border-[var(--d2q-border)] bg-[var(--d2q-surface-elevated)] text-[var(--d2q-muted)] hover:border-[var(--d2q-border-strong)] hover:bg-[var(--d2q-surface)] hover:text-[var(--d2q-text)]"
          }`}
        >
          Custom
        </button>
      </div>

      <div>
        <label
          htmlFor="ai-api-url"
          className="block text-sm font-medium text-[var(--d2q-text)]"
        >
          API endpoint URL
        </label>
        <p className="mt-1 text-sm text-[var(--d2q-muted)]">
          {provider === "custom" ? (
            <>
              <strong>Required</strong> — base URL or full chat-completions URL.
            </>
          ) : provider === "openai" ? (
            <>Leave blank for default OpenAI, or paste a proxy / Azure URL.</>
          ) : (
            <>Leave blank for default Anthropic, or paste a compatible URL.</>
          )}
        </p>
        <input
          id="ai-api-url"
          type="url"
          autoComplete="off"
          spellCheck={false}
          placeholder={defaultEndpointHint(provider)}
          value={urlInput}
          onChange={(e) => handleUrlChange(e.target.value)}
          className="mt-2 w-full rounded-lg border border-[var(--d2q-border)] bg-[var(--d2q-bg)] px-3 py-2 text-sm text-[var(--d2q-text)] shadow-sm focus:border-[var(--d2q-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--d2q-accent)]/30"
        />
      </div>

      <div>
        <label
          htmlFor="ai-model"
          className="block text-sm font-medium text-[var(--d2q-text)]"
        >
          Model
        </label>
        <p className="mt-1 text-sm text-[var(--d2q-muted)]">
          {provider === "custom" ? (
            <strong>Required</strong>
          ) : (
            <>Optional — blank uses built-in default.</>
          )}
        </p>
        <input
          id="ai-model"
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder={defaultModelPlaceholder(provider)}
          value={modelInput}
          onChange={(e) => handleModelChange(e.target.value)}
          className="mt-2 w-full rounded-lg border border-[var(--d2q-border)] bg-[var(--d2q-bg)] px-3 py-2 text-sm text-[var(--d2q-text)] shadow-sm focus:border-[var(--d2q-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--d2q-accent)]/30"
        />
      </div>

      <div>
        <label
          htmlFor="ai-api-key"
          className="block text-sm font-medium text-[var(--d2q-text)]"
        >
          API key
          {provider === "openai"
            ? " (OpenAI)"
            : provider === "anthropic"
              ? " (Anthropic)"
              : " (Bearer token)"}
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-stretch">
          <div className="relative min-w-0 flex-1">
            <input
              id="ai-api-key"
              type={showKey ? "text" : "password"}
              autoComplete="off"
              spellCheck={false}
              value={keyInput}
              onChange={(e) => handleKeyChange(e.target.value)}
              className="w-full rounded-lg border border-[var(--d2q-border)] bg-[var(--d2q-bg)] px-3 py-2 pr-10 text-sm text-[var(--d2q-text)] shadow-sm focus:border-[var(--d2q-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--d2q-accent)]/30"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer rounded p-1 text-[var(--d2q-muted)] transition-colors duration-200 hover:bg-[var(--d2q-surface-elevated)] hover:text-[var(--d2q-text)]"
              aria-label={showKey ? "Hide API key" : "Show API key"}
            >
              {showKey ? "Hide" : "Show"}
            </button>
          </div>
          <button
            type="button"
            onClick={handleClearKey}
            className="cursor-pointer rounded-lg border border-[var(--d2q-border)] bg-[var(--d2q-surface-elevated)] px-4 py-2 text-sm font-medium text-[var(--d2q-muted)] transition-colors duration-200 hover:bg-[var(--d2q-surface)] hover:text-[var(--d2q-text)]"
          >
            Clear
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={
              !hasKey ||
              testRunning ||
              visionTestRunning ||
              !hasCustomEndpoint ||
              !hasCustomModel
            }
            className="cursor-pointer rounded-lg border border-[var(--d2q-accent)] bg-[var(--d2q-accent-muted)] px-4 py-2 text-sm font-semibold text-[var(--d2q-accent-hover)] transition-colors duration-200 hover:bg-[var(--d2q-accent)]/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {testRunning ? "Testing…" : "Test connection"}
          </button>
          {connectionValid ? (
            <span className="inline-flex items-center rounded-full bg-emerald-950/50 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 ring-1 ring-emerald-500/30">
              Valid
            </span>
          ) : null}
          <button
            type="button"
            onClick={handleTestVisionImage}
            disabled={
              !hasKey ||
              testRunning ||
              visionTestRunning ||
              !hasCustomEndpoint ||
              !hasCustomModel ||
              provider === "anthropic"
            }
            title={
              provider === "anthropic"
                ? "Switch to OpenAI or Custom to test image input."
                : undefined
            }
            className="cursor-pointer rounded-lg border border-[var(--d2q-accent-warm)]/60 bg-orange-950/30 px-4 py-2 text-sm font-semibold text-[var(--d2q-accent-warm)] transition-colors duration-200 hover:bg-orange-950/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {visionTestRunning ? "Testing image…" : "Test image input"}
          </button>
          {visionImageTestOk ? (
            <span
              className="inline-flex max-w-[min(100%,18rem)] items-center rounded-full bg-orange-950/40 px-2.5 py-0.5 text-xs font-semibold text-amber-300 ring-1 ring-orange-500/30"
              title={visionTestReply ?? undefined}
            >
              Vision OK
            </span>
          ) : null}
        </div>
        {testError ? (
          <p className="mt-2 text-sm font-medium text-red-400" role="alert">
            {testError}
          </p>
        ) : null}
        {visionTestError ? (
          <p className="mt-2 text-sm font-medium text-red-400" role="alert">
            {visionTestError}
          </p>
        ) : null}
      </div>
    </section>
  );
}

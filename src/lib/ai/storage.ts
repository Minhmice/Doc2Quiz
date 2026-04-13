import {
  LS_PROVIDER,
  type AiProvider,
} from "@/types/question";
import {
  clearForwardSettings,
  migrateForwardSettingsFromLegacy,
  readForwardSettings,
  writeForwardSettings,
} from "@/lib/ai/forwardSettings";

function isAiProvider(value: string | null): value is AiProvider {
  return value === "openai" || value === "anthropic" || value === "custom";
}

/**
 * Runs legacy → forward migration then returns the OpenAI-compat forward kind.
 * `anthropic` is no longer returned once forward settings have an API key (Phase 19).
 */
export function getProvider(): AiProvider {
  if (typeof window === "undefined") {
    return "openai";
  }
  migrateForwardSettingsFromLegacy();
  const { baseUrl, apiKey } = readForwardSettings();
  if (!apiKey.trim()) {
    const raw = localStorage.getItem(LS_PROVIDER);
    return isAiProvider(raw) ? raw : "openai";
  }
  return baseUrl.trim() ? "custom" : "openai";
}

export function setProvider(p: AiProvider): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(LS_PROVIDER, p);
}

/** Migrate + read the unified forward triple (Phase 19). */
export function getForwardClientForUi() {
  migrateForwardSettingsFromLegacy();
  return readForwardSettings();
}

export function getKeyForProvider(p: AiProvider): string {
  void p;
  return readForwardSettings().apiKey;
}

export function setKeyForProvider(p: AiProvider, value: string): void {
  void p;
  writeForwardSettings({ apiKey: value });
}

export function clearKeyForProvider(p: AiProvider): void {
  void p;
  clearForwardSettings();
}

export function getUrlForProvider(p: AiProvider): string {
  void p;
  return readForwardSettings().baseUrl;
}

export function setUrlForProvider(p: AiProvider, value: string): void {
  void p;
  writeForwardSettings({ baseUrl: value });
}

export function clearUrlForProvider(p: AiProvider): void {
  void p;
  clearForwardSettings();
}

export function getModelForProvider(p: AiProvider): string {
  void p;
  return readForwardSettings().modelId;
}

export function setModelForProvider(p: AiProvider, value: string): void {
  void p;
  writeForwardSettings({ modelId: value });
}

export function clearModelForProvider(p: AiProvider): void {
  void p;
  clearForwardSettings();
}

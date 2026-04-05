import {
  LS_ANTHROPIC_KEY,
  LS_OPENAI_KEY,
  LS_PROVIDER,
  type AiProvider,
} from "@/types/question";

const DEFAULT_PROVIDER: AiProvider = "openai";

function isAiProvider(value: string | null): value is AiProvider {
  return value === "openai" || value === "anthropic";
}

export function getProvider(): AiProvider {
  if (typeof window === "undefined") {
    return DEFAULT_PROVIDER;
  }
  const raw = localStorage.getItem(LS_PROVIDER);
  return isAiProvider(raw) ? raw : DEFAULT_PROVIDER;
}

export function setProvider(p: AiProvider): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(LS_PROVIDER, p);
}

function storageKeyForProvider(p: AiProvider): string {
  return p === "openai" ? LS_OPENAI_KEY : LS_ANTHROPIC_KEY;
}

export function getKeyForProvider(p: AiProvider): string {
  if (typeof window === "undefined") {
    return "";
  }
  return localStorage.getItem(storageKeyForProvider(p)) ?? "";
}

export function setKeyForProvider(p: AiProvider, value: string): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(storageKeyForProvider(p), value);
}

export function clearKeyForProvider(p: AiProvider): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.removeItem(storageKeyForProvider(p));
}

import {
  LS_ANTHROPIC_KEY,
  LS_ANTHROPIC_MODEL,
  LS_ANTHROPIC_URL,
  LS_CUSTOM_KEY,
  LS_CUSTOM_MODEL,
  LS_CUSTOM_URL,
  LS_OPENAI_KEY,
  LS_OPENAI_MODEL,
  LS_OPENAI_URL,
  LS_PROVIDER,
  type AiProvider,
} from "@/types/question";

const DEFAULT_PROVIDER: AiProvider = "openai";

function isAiProvider(value: string | null): value is AiProvider {
  return value === "openai" || value === "anthropic" || value === "custom";
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
  switch (p) {
    case "openai":
      return LS_OPENAI_KEY;
    case "anthropic":
      return LS_ANTHROPIC_KEY;
    case "custom":
      return LS_CUSTOM_KEY;
  }
}

function storageUrlKeyForProvider(p: AiProvider): string {
  switch (p) {
    case "openai":
      return LS_OPENAI_URL;
    case "anthropic":
      return LS_ANTHROPIC_URL;
    case "custom":
      return LS_CUSTOM_URL;
  }
}

function storageModelKeyForProvider(p: AiProvider): string {
  switch (p) {
    case "openai":
      return LS_OPENAI_MODEL;
    case "anthropic":
      return LS_ANTHROPIC_MODEL;
    case "custom":
      return LS_CUSTOM_MODEL;
  }
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

export function getUrlForProvider(p: AiProvider): string {
  if (typeof window === "undefined") {
    return "";
  }
  return localStorage.getItem(storageUrlKeyForProvider(p)) ?? "";
}

export function setUrlForProvider(p: AiProvider, value: string): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(storageUrlKeyForProvider(p), value);
}

export function clearUrlForProvider(p: AiProvider): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.removeItem(storageUrlKeyForProvider(p));
}

export function getModelForProvider(p: AiProvider): string {
  if (typeof window === "undefined") {
    return "";
  }
  return localStorage.getItem(storageModelKeyForProvider(p)) ?? "";
}

export function setModelForProvider(p: AiProvider, value: string): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(storageModelKeyForProvider(p), value);
}

export function clearModelForProvider(p: AiProvider): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.removeItem(storageModelKeyForProvider(p));
}

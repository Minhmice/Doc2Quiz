/**
 * OCR provider / key / model mirroring AI flow (localStorage, per-device).
 */
import {
  LS_OCR_KEY,
  LS_OCR_MODEL,
  LS_OCR_PROVIDER,
  LS_OCR_URL,
} from "@/types/ocr";
import type { OcrProvider } from "@/types/ocr";

const DEFAULT_PROVIDER: OcrProvider = "openai";

function isOcrProvider(value: string | null): value is OcrProvider {
  return value === "openai" || value === "custom";
}

export function getOcrProvider(): OcrProvider {
  if (typeof window === "undefined") return DEFAULT_PROVIDER;
  const raw = localStorage.getItem(LS_OCR_PROVIDER);
  return isOcrProvider(raw) ? raw : DEFAULT_PROVIDER;
}

export function setOcrProvider(p: OcrProvider): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_OCR_PROVIDER, p);
}

export function getOcrKey(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(LS_OCR_KEY) ?? "";
}

export function setOcrKey(v: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_OCR_KEY, v);
}

export function getOcrUrl(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(LS_OCR_URL) ?? "";
}

export function setOcrUrl(v: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_OCR_URL, v);
}

export function getOcrModel(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(LS_OCR_MODEL) ?? "";
}

export function setOcrModel(v: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_OCR_MODEL, v);
}

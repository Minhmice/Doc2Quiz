export const LS_DISPLAY_NAME = "doc2quiz:profile:displayName";
export const LS_NAME_PROMPT_DISMISSED = "doc2quiz:profile:namePromptDismissed";

export function readDisplayName(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = localStorage.getItem(LS_DISPLAY_NAME);
  if (raw == null || raw === "") {
    return null;
  }
  return raw;
}

export function writeDisplayName(name: string): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(LS_DISPLAY_NAME, name);
}

export function readPromptDismissed(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return localStorage.getItem(LS_NAME_PROMPT_DISMISSED) === "1";
}

export function writePromptDismissed(): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(LS_NAME_PROMPT_DISMISSED, "1");
}

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { messageDomains, messages } from "./messages";
import { slangCatalog } from "./slang";
import { locales, slangContexts } from "./types";

const root = resolve(process.cwd());
const source = (path: string) => readFileSync(resolve(root, path), "utf8");

function leafPaths(value: unknown, prefix = ""): string[] {
  if (typeof value === "string" || typeof value === "function") return [prefix];
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => leafPaths(child, prefix ? `${prefix}.${key}` : key));
}

describe("phase-wide locale coverage", () => {
  it("keeps every declared message domain complete and non-empty in both locales", () => {
    const englishPaths = leafPaths(messages.en).sort();
    expect(messageDomains).toEqual(expect.arrayContaining(Object.keys(messages.en)));
    for (const locale of locales) {
      expect(leafPaths(messages[locale]).sort()).toEqual(englishPaths);
      expect(leafPaths(messages[locale])).not.toContain("");
    }
  });

  it("keeps every safe slang context populated, unique, and free of banned content", () => {
    const banned = /(?:skill issue|npc answer|negative aura|\bdm\b|địt|đụ|racist|ableist)/i;
    for (const locale of locales) {
      expect(Object.keys(slangCatalog[locale]).sort()).toEqual([...slangContexts].sort());
      for (const context of slangContexts) {
        const entries = slangCatalog[locale][context];
        expect(entries.length).toBeGreaterThanOrEqual(2);
        expect(new Set(entries.map(({ text }) => text.trim().toLocaleLowerCase())).size).toBe(entries.length);
        for (const { text } of entries) {
          expect(text.trim()).not.toBe("");
          expect(text).not.toMatch(banned);
        }
      }
    }
  });

  it("does not define slang mappings for critical product categories", () => {
    const critical = ["error", "destructive", "account", "privacy", "accessibility", "auth", "recovery"];
    for (const locale of locales) {
      for (const context of critical) expect(context in slangCatalog[locale]).toBe(false);
    }
  });

  it("wires representative UI surfaces through typed locale APIs", () => {
    const markers: Record<string, RegExp[]> = {
      "src/components/locale/LocaleProvider.tsx": [/messages\[locale\]/, /readLocale/, /applyDocumentLocale\([^,]+, document\.documentElement\)/],
      "src/components/locale/LanguageSelector.tsx": [/useLocale/, /setLocale/],
      "src/components/processing/conversion-progress.tsx": [/useLocale/, /messages\.progress/],
      "src/components/quiz/QuizSession.tsx": [/useLocale/, /LocalizedSlangLine/, /context=\{answerCorrect \? "correct" : "wrong"\}/],
      "src/components/dashboard/DashboardHomeClient.tsx": [/useLocale/, /messages\.dashboard/, /WorkspaceCard/],
      "src/components/workspaces/WorkspaceCollaborationPanel.tsx": [/useLocale/, /messages\.collaboration\.panel/, /canManageWorkspaceCollaboration/],
      "src/components/settings/SocialSafetySettings.tsx": [/useLocale/, /messages\.socialSafety/, /fetchProfileUsername/],
    };
    for (const [file, patterns] of Object.entries(markers)) {
      const contents = source(file);
      for (const pattern of patterns) expect(contents, `${file} must match ${pattern}`).toMatch(pattern);
    }
  });

  it("keeps deterministic selection and validated storage suites reachable", () => {
    expect(source("src/lib/locale/selectSlang.test.ts")).toMatch(/no.?repeat|previous/i);
    expect(source("src/lib/locale/localeStorage.test.ts")).toMatch(/invalid|fallback/i);
    expect(source("src/components/locale/LocaleProvider.test.tsx")).toMatch(/server|storage|document/i);
  });
});

import { describe, expect, it } from "vitest";

import { slangCatalog } from "./slang";
import { slangContexts } from "./types";

const forbidden = [
  /skill issue/i,
  /lỗi kỹ năng/i,
  /npc/i,
  /negative aura/i,
  /aura âm/i,
  /f+u+c+k/i,
  /bitch/i,
  /retard/i,
  /racist/i,
  /delete|password|login|log in|privacy|account recovery|screen reader/i,
  /xóa|mật khẩu|đăng nhập|quyền riêng tư|khôi phục tài khoản/i,
];

describe("slangCatalog", () => {
  it.each(["en", "vi"] as const)("populates every context for %s", (locale) => {
    expect(Object.keys(slangCatalog[locale])).toEqual(slangContexts);
    for (const context of slangContexts) {
      expect(slangCatalog[locale][context].length).toBeGreaterThanOrEqual(2);
    }
  });

  it.each(["en", "vi"] as const)("contains no duplicate text within %s banks", (locale) => {
    for (const context of slangContexts) {
      const texts = slangCatalog[locale][context].map(({ text }) => text.toLocaleLowerCase());
      expect(new Set(texts).size, `${locale}.${context}`).toBe(texts.length);
    }
  });

  it("keeps approved banks plain, non-hostile, and free of forbidden copy classes", () => {
    for (const locale of ["en", "vi"] as const) {
      for (const context of slangContexts) {
        for (const entry of slangCatalog[locale][context]) {
          expect(entry.text.trim()).toBe(entry.text);
          expect(entry.text.length).toBeGreaterThan(0);
          expect(entry.text).not.toMatch(/[<>]/);
          for (const pattern of forbidden) expect(entry.text).not.toMatch(pattern);
        }
      }
    }
  });

  it("limits tones to approved non-hostile classifications", () => {
    const allowed = new Set(["praise", "encourage", "playful", "warning", "easterEgg"]);
    for (const locale of ["en", "vi"] as const) {
      for (const context of slangContexts) {
        for (const entry of slangCatalog[locale][context]) expect(allowed.has(entry.tone)).toBe(true);
      }
    }
  });
});

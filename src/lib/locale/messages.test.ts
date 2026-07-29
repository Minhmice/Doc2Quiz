import { describe, expect, it } from "vitest";

import { messages, messageDomains } from "./messages";

function flattenKeys(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    flattenKeys(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe("messages", () => {
  it("keeps English and Vietnamese catalog keys in parity", () => {
    expect(flattenKeys(messages.vi).sort()).toEqual(flattenKeys(messages.en).sort());
  });

  it("covers every required product-copy domain", () => {
    expect(Object.keys(messages.en)).toEqual(messageDomains);
    expect(Object.keys(messages.vi)).toEqual(messageDomains);
  });

  it("uses typed functions for dynamic copy", () => {
    expect(messages.en.score.correctCount(3, 5)).toBe("3 of 5 correct");
    expect(messages.vi.score.correctCount(3, 5)).toBe("Đúng 3/5 câu");
    expect(messages.en.progress.percent(42)).toBe("42% complete");
  });
});

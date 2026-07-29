import { describe, expect, it } from "vitest";

import { createSlangRotator, selectSlang } from "./selectSlang";
import type { SlangEntry } from "./types";

const entries = (texts: string[]): SlangEntry[] => texts.map((text) => ({ text, tone: "playful" }));

describe("selectSlang", () => {
  it("returns null for empty banks and the only entry for singleton banks", () => {
    expect(selectSlang([], undefined, () => 0)).toBeNull();
    expect(selectSlang(entries(["only"]), "only", () => 0.9)?.text).toBe("only");
  });

  it("excludes every entry matching the immediately previous text", () => {
    const bank = entries(["first", "second", "third"]);
    expect(selectSlang(bank, "first", () => 0)?.text).toBe("second");
    expect(selectSlang(bank, "first", () => 0.999999)?.text).toBe("third");
  });

  it("bounds deterministic RNG values at lower, interior, and upper edges", () => {
    const bank = entries(["a", "b", "c"]);
    expect(selectSlang(bank, undefined, () => 0)?.text).toBe("a");
    expect(selectSlang(bank, undefined, () => 1 / 3)?.text).toBe("b");
    expect(selectSlang(bank, undefined, () => 1)?.text).toBe("c");
    expect(selectSlang(bank, undefined, () => -1)?.text).toBe("a");
  });
});

describe("createSlangRotator", () => {
  it("isolates history by locale and context", () => {
    const rotator = createSlangRotator(() => 0);
    const enLoading = rotator.getRandomSlang("loading", "en");
    expect(rotator.getRandomSlang("loading", "en")?.text).not.toBe(enLoading?.text);
    expect(rotator.getRandomSlang("upload", "en")?.text).toBeDefined();
    expect(rotator.getRandomSlang("loading", "vi")?.text).toBeDefined();
  });

  it("can reset one locale without clearing the other", () => {
    const rotator = createSlangRotator(() => 0);
    const firstEn = rotator.getRandomSlang("correct", "en")?.text;
    const firstVi = rotator.getRandomSlang("correct", "vi")?.text;
    rotator.reset("en");
    expect(rotator.getRandomSlang("correct", "en")?.text).toBe(firstEn);
    expect(rotator.getRandomSlang("correct", "vi")?.text).not.toBe(firstVi);
  });
});

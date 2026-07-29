import { describe, expect, it } from "vitest";

import { DEFAULT_LOCALE } from "./messages";
import { LOCALE_STORAGE_KEY, readLocale, writeLocale } from "./localeStorage";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe("localeStorage", () => {
  it("falls back to English without browser storage", () => {
    expect(readLocale()).toBe(DEFAULT_LOCALE);
  });

  it("falls back for missing, invalid, cleared, or throwing storage", () => {
    const storage = new MemoryStorage();
    expect(readLocale(storage)).toBe("en");
    storage.setItem(LOCALE_STORAGE_KEY, "fr");
    expect(readLocale(storage)).toBe("en");
    storage.removeItem(LOCALE_STORAGE_KEY);
    expect(readLocale(storage)).toBe("en");
    expect(readLocale({ getItem: () => { throw new Error("blocked"); } } as unknown as Storage)).toBe("en");
  });

  it("persists valid Vietnamese and English values", () => {
    const storage = new MemoryStorage();
    expect(writeLocale("vi", storage)).toBe(true);
    expect(readLocale(storage)).toBe("vi");
    expect(writeLocale("en", storage)).toBe(true);
    expect(readLocale(storage)).toBe("en");
  });

  it("rejects invalid runtime values without writing", () => {
    const storage = new MemoryStorage();
    expect(writeLocale("fr" as never, storage)).toBe(false);
    expect(storage.getItem(LOCALE_STORAGE_KEY)).toBeNull();
  });
});

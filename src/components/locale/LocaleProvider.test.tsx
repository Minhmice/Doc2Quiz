import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_LOCALE, messages } from "@/lib/locale/messages";
import { LOCALE_STORAGE_KEY } from "@/lib/locale/localeStorage";
import {
  LocaleProvider,
  applyDocumentLocale,
  localeFromStorageEvent,
  readInitialLocale,
} from "./LocaleProvider";

describe("LocaleProvider", () => {
  it("renders deterministic English markup on server", () => {
    const html = renderToStaticMarkup(
      createElement(LocaleProvider, null, createElement("span", null, messages[DEFAULT_LOCALE].settings.languageTitle)),
    );

    expect(html).toContain("Choose civilization");
    expect(html).not.toContain("Ngôn ngữ");
  });

  it("reads a valid stored locale only through the hydration boundary", () => {
    const storage = { getItem: vi.fn(() => "vi") } as unknown as Storage;
    expect(readInitialLocale(storage)).toBe("vi");

    const invalidStorage = { getItem: vi.fn(() => "fr") } as unknown as Storage;
    expect(readInitialLocale(invalidStorage)).toBe("en");
  });

  it("updates document language through an injected boundary", () => {
    const root = { lang: "en" };
    applyDocumentLocale("vi", root);
    expect(root.lang).toBe("vi");
  });

  it("accepts only valid locale events for the locale storage key", () => {
    expect(localeFromStorageEvent({ key: LOCALE_STORAGE_KEY, newValue: "vi" })).toBe("vi");
    expect(localeFromStorageEvent({ key: LOCALE_STORAGE_KEY, newValue: "fr" })).toBeNull();
    expect(localeFromStorageEvent({ key: "other", newValue: "vi" })).toBeNull();
  });
});

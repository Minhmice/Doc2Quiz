import { describe, expect, it } from "vitest";
import {
  DEFAULT_THEME_PREFERENCE,
  THEME_PREFERENCES,
  isThemePreference,
  themePreferenceOrDefault,
} from "./themePreference";

describe("themePreference", () => {
  it("accepts every supported preference", () => {
    for (const theme of THEME_PREFERENCES) {
      expect(isThemePreference(theme)).toBe(true);
      expect(themePreferenceOrDefault(theme)).toBe(theme);
    }
  });

  it("falls back from malformed database values", () => {
    for (const value of [null, undefined, "dark", "", 1, {}]) {
      expect(isThemePreference(value)).toBe(false);
      expect(themePreferenceOrDefault(value)).toBe(DEFAULT_THEME_PREFERENCE);
    }
  });
});

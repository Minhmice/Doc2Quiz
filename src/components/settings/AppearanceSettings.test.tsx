import { createElement } from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "@/components/locale/LocaleProvider";
import { AppearanceSettings } from "./AppearanceSettings";

vi.mock("@/components/providers/ThemePreferenceProvider", () => ({
  useThemePreference: () => ({
    themePreference: "vscode-dark",
    setThemePreference: vi.fn(),
  }),
}));

describe("AppearanceSettings", () => {
  it("renders one keyboard-navigable radio group with visible selected state", () => {
    const html = renderToStaticMarkup(
      createElement(
        LocaleProvider,
        { initialLocale: "en" },
        createElement(AppearanceSettings),
      ),
    );
    const source = readFileSync(
      resolve(process.cwd(), "src/components/settings/AppearanceSettings.tsx"),
      "utf8",
    );

    expect(html).toContain('role="radiogroup"');
    expect(html.match(/role="radio"/g)).toHaveLength(5);
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("VS Code Dark");
    expect(html).toContain("High Contrast");
    expect(source).toContain('"ArrowDown"');
    expect(source).toContain('"ArrowRight"');
    expect(source).toContain('"ArrowUp"');
    expect(source).toContain('"ArrowLeft"');
  });
});

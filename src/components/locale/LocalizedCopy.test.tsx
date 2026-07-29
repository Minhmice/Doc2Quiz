import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LocaleProvider } from "./LocaleProvider";
import {
  LocalizedSlangLine,
  resolveEventSlang,
  type EventSlangSnapshot,
} from "./LocalizedCopy";

describe("LocalizedCopy", () => {
  it("renders no random phrase in server output", () => {
    const html = renderToStaticMarkup(
      createElement(
        LocaleProvider,
        null,
        createElement(LocalizedSlangLine, { context: "upload", eventKey: "validating" }),
      ),
    );

    expect(html).toBe("");
  });

  it("keeps a selected phrase across unrelated rerenders", () => {
    const previous: EventSlangSnapshot = {
      locale: "en",
      context: "upload",
      eventKey: "uploading",
      text: "Locked in.",
    };

    expect(resolveEventSlang(previous, "en", "upload", "uploading", true, () => "Changed")).toBe(previous);
  });

  it("selects again only when locale, context, or semantic event changes", () => {
    const previous: EventSlangSnapshot = {
      locale: "en",
      context: "upload",
      eventKey: "uploading",
      text: "Locked in.",
    };

    expect(resolveEventSlang(previous, "en", "upload", "converting", true, () => "Cooking now.")).toEqual({
      locale: "en",
      context: "upload",
      eventKey: "converting",
      text: "Cooking now.",
    });
    expect(resolveEventSlang(previous, "vi", "upload", "uploading", true, () => "Đang vào guồng.")).toEqual({
      locale: "vi",
      context: "upload",
      eventKey: "uploading",
      text: "Đang vào guồng.",
    });
  });

  it("suppresses disabled and unavailable slang", () => {
    const previous: EventSlangSnapshot = {
      locale: "en",
      context: "conversion",
      eventKey: "working",
      text: "Still cooking.",
    };

    expect(resolveEventSlang(previous, "en", "conversion", "error", false, () => "Unsafe")).toBeNull();
    expect(resolveEventSlang(null, "en", "conversion", "working", true, () => null)).toBeNull();
  });
});

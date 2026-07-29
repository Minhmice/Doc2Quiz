import { describe, expect, it } from "vitest";

import { getQuotaWeekResetsAtIct, getQuotaWeekStartIct } from "./quotaWeek";

describe("quota week", () => {
  it("starts Monday at midnight ICT", () => {
    const date = new Date("2026-08-02T18:00:00.000Z");
    expect(getQuotaWeekStartIct(date).toISOString()).toBe("2026-08-02T17:00:00.000Z");
    expect(getQuotaWeekResetsAtIct(date).toISOString()).toBe("2026-08-09T17:00:00.000Z");
  });
});

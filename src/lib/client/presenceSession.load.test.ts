import { describe, expect, it } from "vitest";
import { evidenceSchema, validateConfig } from "../../../scripts/social-presence-load.mjs";

describe("social presence load harness", () => {
  it("defines healthy and outage scenarios with required thresholds", () => {
    expect(evidenceSchema.scenarios.map(({ id }) => id)).toEqual(["healthy-100", "healthy-1000", "outage-recovery"]);
    expect(evidenceSchema.thresholds).toMatchObject({ postgresHeartbeatWrites: "=0", heartbeatP95Ms: "<=500", queueOldestSeconds: "<=30" });
  });

  it("fails closed without explicit disposable target confirmations", () => {
    expect(validateConfig({})).toContain("confirmations");
    expect(validateConfig({ PHASE15_TEST_CONFIRM: "YES", PHASE15_REDIS_TEST_CONFIRM: "YES", PHASE15_TEST_REDIS_URL: "redis://production.example", PHASE15_TEST_DATABASE_URL: "postgres://localhost/test" })).toContain("Approved disposable");
  });
});

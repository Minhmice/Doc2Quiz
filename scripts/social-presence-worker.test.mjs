import { afterEach, describe, expect, it, vi } from "vitest";

import { parseStreamEvent, processEntries, runOnce, workerConfig } from "./social-presence-worker.mjs";

const env = {
  REDIS_URL: "redis://localhost:6379",
  NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key-123",
  SOCIAL_WORKER_GROUP: "social-workers",
  SOCIAL_WORKER_CONSUMER: "worker-1",
};
const event = {
  eventId: "00000000-0000-4000-8000-000000000001",
  userId: "00000000-0000-4000-8000-000000000002",
  occurredAt: "2026-08-09T00:00:00.000Z",
  activityKind: "message_sent",
  source: "message",
  dedupeKey: "00000000-0000-4000-8000-000000000002:message_sent:1",
};

function redis() {
  return {
    xGroupCreate: vi.fn().mockResolvedValue("OK"),
    xAutoClaim: vi.fn().mockResolvedValue({ messages: [] }),
    xReadGroup: vi.fn().mockResolvedValue([{ messages: [{ id: "1-0", message: event }] }]),
    xAck: vi.fn().mockResolvedValue(1),
    xAdd: vi.fn().mockResolvedValue("1-0"),
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    quit: vi.fn().mockResolvedValue("OK"),
  };
}

afterEach(() => vi.restoreAllMocks());

describe("social presence worker", () => {
  it("rejects missing or unbounded config", () => {
    expect(() => workerConfig({})).toThrow("REDIS_URL");
    expect(() => workerConfig({ ...env, SOCIAL_WORKER_BATCH_SIZE: "201" })).toThrow("SOCIAL_WORKER_BATCH_SIZE");
    expect(() => workerConfig({ ...env, SOCIAL_WORKER_BLOCK_MS: "0" })).toThrow("SOCIAL_WORKER_BLOCK_MS");
    expect(() => workerConfig({ ...env, SOCIAL_WORKER_LEASE_MS: "1" })).toThrow("SOCIAL_WORKER_LEASE_MS");
    expect(() => workerConfig({ ...env, SOCIAL_WORKER_MAX_RETRIES: "4" })).toThrow("SOCIAL_WORKER_MAX_RETRIES");
  });

  it("reads bounded batches and acknowledges only after durable commit", async () => {
    const client = redis();
    const rpc = vi.fn().mockResolvedValue({ error: null });
    await runOnce({ redis: client, supabase: { rpc }, config: workerConfig(env) });

    expect(client.xAutoClaim).toHaveBeenCalledWith("d2q:activity", "social-workers", "worker-1", 30_000, "0-0", { COUNT: 100 });
    expect(client.xReadGroup).toHaveBeenCalledWith("social-workers", "worker-1", { key: "d2q:activity", id: ">" }, { COUNT: 100, BLOCK: 10_000 });
    expect(rpc).toHaveBeenCalledWith("apply_social_activity_batch", { p_events: [event] });
    expect(client.xAck).toHaveBeenCalledWith("d2q:activity", "social-workers", ["1-0"]);
    expect(rpc.mock.invocationCallOrder[0]).toBeLessThan(client.xAck.mock.invocationCallOrder[0]);
  });

  it("leaves retryable work pending, claims stale entries, and dead-letters fifth failure", async () => {
    const client = redis();
    client.incr.mockResolvedValue(5);
    const entries = [{ id: "1-0", group: "social-workers", message: event }];
    const result = await processEntries({ redis: client, supabase: { rpc: vi.fn().mockResolvedValue({ error: { message: "down" } }) }, config: workerConfig(env), entries });

    expect(result).toEqual({ processed: 0, retries: 1, deadLetters: 1 });
    expect(client.xAdd).toHaveBeenCalledWith("d2q:activity:dead", "*", { entryId: "1-0", reason: "durable_commit_failed" }, expect.any(Object));
    expect(client.xAck).toHaveBeenCalledWith("d2q:activity", "social-workers", "1-0");
    expect(() => parseStreamEvent({ ...event, body: "private" })).toThrow("invalid activity event");
  });
});

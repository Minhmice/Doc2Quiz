import { describe, expect, it } from "vitest";

import { normalizeSupabaseUrl } from "./env";

describe("normalizeSupabaseUrl", () => {
  it("prepends https:// to host-only URLs", () => {
    expect(normalizeSupabaseUrl("abcd.supabase.co")).toBe(
      "https://abcd.supabase.co",
    );
    expect(normalizeSupabaseUrl("doc2quiz-supa.example.com")).toBe(
      "https://doc2quiz-supa.example.com",
    );
  });

  it("preserves explicit http and https", () => {
    expect(normalizeSupabaseUrl("http://doc2quiz-supa.example.com")).toBe(
      "http://doc2quiz-supa.example.com",
    );
    expect(normalizeSupabaseUrl("https://abcd.supabase.co/")).toBe(
      "https://abcd.supabase.co",
    );
  });

  it("uses http for localhost and 127.0.0.1", () => {
    expect(normalizeSupabaseUrl("127.0.0.1:54321")).toBe(
      "http://127.0.0.1:54321",
    );
    expect(normalizeSupabaseUrl("localhost:54321")).toBe(
      "http://localhost:54321",
    );
  });

  it("trims whitespace and trailing slashes", () => {
    expect(normalizeSupabaseUrl("  https://x.supabase.co/  ")).toBe(
      "https://x.supabase.co",
    );
  });
});

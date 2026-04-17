export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? null;

export function requireSupabasePublicEnv(): {
  url: string;
  anonKey: string;
} {
  const isNextBuild = process.env.NEXT_PHASE === "phase-production-build";
  if (isNextBuild && (!SUPABASE_URL || !SUPABASE_ANON_KEY)) {
    // Allow `next build` to prerender routes in environments that don't configure Supabase.
    // Runtime usage will still fail fast if the app actually tries to connect without envs.
    return {
      url: SUPABASE_URL ?? "http://localhost",
      anonKey: SUPABASE_ANON_KEY ?? "missing-supabase-anon-key",
    };
  }
  if (!SUPABASE_URL) {
    throw new Error(
      "Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL. Add it to your environment (or .env.local).",
    );
  }
  if (!SUPABASE_ANON_KEY) {
    throw new Error(
      "Missing required environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY. Add it to your environment (or .env.local).",
    );
  }
  return { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY };
}


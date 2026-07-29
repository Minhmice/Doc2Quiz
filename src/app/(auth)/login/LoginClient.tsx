"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

import { Button } from "@/components/buttons/button";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/client/supabase";
import { formatAuthClientError } from "@/lib/supabase/authErrors";

export function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = useMemo(() => {
    const raw = searchParams.get("next");
    if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
      return "/dashboard";
    }
    return raw;
  }, [searchParams]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!cancelled && user) {
          router.replace(nextPath);
        }
      } catch {
        // Supabase unreachable — stay on login.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [nextPath, router]);

  return (
    <div className="space-y-6">
      <div className="d2q-auth-enter space-y-3 text-center" style={{ "--i": 0 } as CSSProperties}>
        <p className="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Welcome back
        </p>
        <h1 className="font-heading text-balance text-[clamp(1.875rem,4vw,2.25rem)] font-extrabold leading-[1.15] tracking-[-0.02em] text-foreground">
          Sign in
        </h1>
        <p className="text-sm text-muted-foreground">
          Email and password to open your library.
        </p>
      </div>

      <form
        className="d2q-auth-enter space-y-4"
        style={{ "--i": 1 } as CSSProperties}
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          setBusy(true);
          const alive = true;
          void (async () => {
            try {
              const supabase = createSupabaseBrowserClient();
              const { error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password,
              });
              if (!alive) return;
              if (signInError) {
                setError(formatAuthClientError(signInError, "Sign in failed."));
                return;
              }
              router.replace(nextPath);
              router.refresh();
            } catch (err) {
              if (!alive) return;
              setError(formatAuthClientError(err, "Sign in failed."));
            } finally {
              if (alive) setBusy(false);
            }
          })();
        }}
      >
        <div className="space-y-2">
          <label className="font-label text-xs font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="email">
            Email
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="d2q-auth-input rounded-sm border-0 border-b-2 border-transparent bg-input shadow-none ring-0 focus-visible:outline-none focus-visible:ring-3 focus-visible:border-primary focus-visible:ring-ring/40"
          />
        </div>
        <div className="space-y-2">
          <label className="font-label text-xs font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="password">
            Password
          </label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="d2q-auth-input rounded-sm border-0 border-b-2 border-transparent bg-input shadow-none ring-0 focus-visible:outline-none focus-visible:ring-3 focus-visible:border-primary focus-visible:ring-ring/40"
          />
        </div>

        {error ? (
          <p className="d2q-auth-error text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <Button
          type="submit"
          className="d2q-auth-cta h-12 w-full rounded-sm font-heading text-base font-extrabold tracking-tight bg-primary text-primary-foreground"
          disabled={busy}
        >
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p
        className="d2q-auth-enter text-center text-sm text-muted-foreground"
        style={{ "--i": 2 } as CSSProperties}
      >
        No account?{" "}
        <Link
          className="d2q-auth-link font-semibold text-primary underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          href="/signup"
        >
          Create one
        </Link>
      </p>
    </div>
  );
}

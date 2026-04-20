"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/buttons/button";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

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
    void (async () => {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        router.replace(nextPath);
      }
    })();
  }, [nextPath, router]);

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <p className="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Welcome back
        </p>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
          Sign in
        </h1>
        <p className="text-sm text-muted-foreground">
          Email and password to open your library.
        </p>
      </div>

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          setBusy(true);
          void (async () => {
            try {
              const supabase = createSupabaseBrowserClient();
              const { error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password,
              });
              if (signInError) {
                setError(signInError.message);
                return;
              }
              router.replace(nextPath);
              router.refresh();
            } catch {
              setError("Sign in failed.");
            } finally {
              setBusy(false);
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
            className="rounded-sm border-0 border-b-2 border-transparent bg-input shadow-none ring-0 focus-visible:border-primary focus-visible:ring-0"
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
            className="rounded-sm border-0 border-b-2 border-transparent bg-input shadow-none ring-0 focus-visible:border-primary focus-visible:ring-0"
          />
        </div>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <Button
          type="submit"
          className="h-11 w-full rounded-sm font-heading font-semibold tracking-tight"
          disabled={busy}
        >
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        No account?{" "}
        <Link className="font-semibold text-primary underline-offset-4 hover:underline" href="/signup">
          Create one
        </Link>
      </p>
    </div>
  );
}

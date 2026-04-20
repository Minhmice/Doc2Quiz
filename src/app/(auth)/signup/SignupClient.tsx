"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/buttons/button";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function SignupClient() {
  const router = useRouter();
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
        router.replace("/dashboard");
      }
    })();
  }, [router]);

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <p className="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Create account
        </p>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
          Join Doc2Quiz
        </h1>
        <p className="text-sm text-muted-foreground">
          Email + password. No email verification in this app flow.
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
              const origin =
                typeof window !== "undefined" ? window.location.origin : "";
              const { data, error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options:
                  origin.length > 0
                    ? { emailRedirectTo: `${origin}/dashboard` }
                    : undefined,
              });
              if (signUpError) {
                setError(signUpError.message);
                return;
              }

              if (data.session) {
                router.replace("/dashboard");
                router.refresh();
                return;
              }

              const { data: signInData, error: signInError } =
                await supabase.auth.signInWithPassword({ email, password });
              if (signInData.session) {
                router.replace("/dashboard");
                router.refresh();
                return;
              }

              setError(
                signInError?.message ??
                  "No session after sign up. Turn off Confirm email in Supabase (Authentication → Providers → Email), or confirm the user in Dashboard. See supabase/EMAIL_AUTH_SETUP.md.",
              );
            } catch {
              setError("Sign up failed.");
            } finally {
              setBusy(false);
            }
          })();
        }}
      >
        <div className="space-y-2">
          <label className="font-label text-xs font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="signup-email">
            Email
          </label>
          <Input
            id="signup-email"
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
          <label
            className="font-label text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            htmlFor="signup-password"
          >
            Password
          </label>
          <Input
            id="signup-password"
            name="password"
            type="password"
            autoComplete="new-password"
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
          {busy ? "Creating…" : "Create account"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link className="font-semibold text-primary underline-offset-4 hover:underline" href="/login">
          Sign in
        </Link>
      </p>
    </div>
  );
}

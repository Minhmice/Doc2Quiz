"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type DevState =
  | { status: "hidden" }
  | { status: "loading" }
  | {
      status: "ready";
      tier: string;
      resolvedModel: string;
      urlConfigured: boolean;
      keyConfigured: boolean;
    }
  | { status: "error"; message: string };

export function DevEnginePanel() {
  const [state, setState] = useState<DevState>({ status: "loading" });
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/ai/dev-engine-panel");
        if (res.status === 404) {
          if (!cancelled) {
            setState({ status: "hidden" });
          }
          return;
        }
        if (!res.ok) {
          if (!cancelled) {
            setState({ status: "error", message: `HTTP ${res.status}` });
          }
          return;
        }
        const data = (await res.json()) as {
          tier?: unknown;
          resolvedModel?: unknown;
          urlConfigured?: unknown;
          keyConfigured?: unknown;
        };
        if (!cancelled) {
          setState({
            status: "ready",
            tier: String(data.tier ?? ""),
            resolvedModel: String(data.resolvedModel ?? ""),
            urlConfigured: data.urlConfigured === true,
            keyConfigured: data.keyConfigured === true,
          });
        }
      } catch {
        if (!cancelled) {
          setState({ status: "hidden" });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const runTest = useCallback(async () => {
    setTesting(true);
    setTestMsg(null);
    try {
      const res = await fetch("/api/ai/dev-engine-panel", { method: "POST" });
      const body = (await res.json()) as { ok?: unknown; message?: unknown };
      const ok = body.ok === true;
      setTestMsg(
        ok
          ? "Connection OK."
          : typeof body.message === "string"
            ? body.message
            : "Test failed.",
      );
    } catch {
      setTestMsg("Request failed.");
    } finally {
      setTesting(false);
    }
  }, []);

  if (state.status === "hidden" || state.status === "loading") {
    return null;
  }

  if (state.status === "error") {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Dev engine panel: {state.message}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-dashed border-amber-600/40 bg-amber-950/10 p-6">
      <p className="font-label text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        Developer
      </p>
      <h2 className="font-heading mt-1 text-lg font-semibold text-[var(--d2q-text)]">
        Processing debug
      </h2>
      <p className="mt-2 text-sm text-[var(--d2q-muted)]">
        Non-production only. Never exposes raw secrets.
      </p>
      <dl className="mt-4 grid gap-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Tier</dt>
          <dd className="font-mono text-xs">{state.tier}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Resolved model</dt>
          <dd className="font-mono text-xs">{state.resolvedModel}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">URL configured</dt>
          <dd>{state.urlConfigured ? "yes" : "no"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Key configured</dt>
          <dd>{state.keyConfigured ? "yes" : "no"}</dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={testing}
          onClick={() => void runTest()}
        >
          {testing ? "Testing…" : "Test connection"}
        </Button>
        {testMsg ? (
          <span className="text-xs text-muted-foreground">{testMsg}</span>
        ) : null}
      </div>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Prefetch frequent app routes so client navigations reuse warmed RSC payloads. */
const PREFETCH_ROUTES = [
  "/dashboard",
  "/settings",
  "/create",
  "/quiz/create",
  "/flashcard/create",
] as const;

export function RoutePrefetch() {
  const router = useRouter();

  useEffect(() => {
    const prefetch = () => {
      for (const href of PREFETCH_ROUTES) {
        router.prefetch(href);
      }
    };

    // Defer until the current page finishes loading so dev compiles are not raced.
    const delayMs = 2500;
    const schedule = () => window.setTimeout(prefetch, delayMs);
    let timer: number | undefined;

    if (document.readyState === "complete") {
      timer = schedule();
    } else {
      const onLoad = () => {
        timer = schedule();
      };
      window.addEventListener("load", onLoad, { once: true });
      return () => {
        window.removeEventListener("load", onLoad);
        if (timer !== undefined) {
          window.clearTimeout(timer);
        }
      };
    }

    return () => {
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
    };
  }, [router]);

  return null;
}

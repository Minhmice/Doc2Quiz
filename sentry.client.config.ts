// This file configures the browser Sentry SDK for Next.js.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();

Sentry.init({
  dsn: dsn || undefined,
  enabled: Boolean(dsn),
  tracesSampleRate: 0,
  beforeSend(event) {
    // Strip PII / secrets in 13-02+; never attach PDF bytes or API keys.
    return event;
  },
});

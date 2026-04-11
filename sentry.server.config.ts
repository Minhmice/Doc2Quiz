// This file configures the server-side Sentry SDK. It runs when imported from
// `instrumentation.ts` on the Node.js runtime only.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN?.trim();

Sentry.init({
  dsn: dsn || undefined,
  enabled: Boolean(dsn),
  tracesSampleRate: 0,
  beforeSend(event) {
    // Strip PII / secrets in 13-02+; never attach PDF bytes or API keys.
    return event;
  },
});

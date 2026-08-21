import * as Sentry from '@sentry/astro';

// ADR-0019 decision 6: no DSN configured is the intended fail-open state
// for local dev — the SDK no-ops entirely.
console.log('[sentry-verify] DSN configured:', Boolean(process.env.PUBLIC_SENTRY_DSN));
Sentry.init({
  dsn: process.env.PUBLIC_SENTRY_DSN,
  debug: true, // ADR-0019 decision 5 — remove once delivery is confirmed
});

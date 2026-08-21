import * as Sentry from '@sentry/astro';

// ADR-0019 decision 6: no DSN configured is the intended fail-open state
// for local dev — the SDK no-ops entirely.
Sentry.init({
  dsn: process.env.PUBLIC_SENTRY_DSN,
});

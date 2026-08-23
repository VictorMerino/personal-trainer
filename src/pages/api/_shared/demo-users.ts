// PUBLIC_DEMO_USER_IDS is a comma-separated list of user ids (not emails —
// ids are what every downstream check already keys on) for the publicly-
// credentialed demo account(s) documented in the README. Env var, not a DB
// column: this is deployment config, not domain data, so it's trivial to
// rotate/drop without a migration. PUBLIC_-prefixed (not secret) because
// the client bundle needs it too, for the on-screen "this is a demo
// account" banner — see shared/ui/DemoBanner.svelte.
export function isDemoUser(userId: string): boolean {
  const raw = import.meta.env.PUBLIC_DEMO_USER_IDS ?? '';
  return raw
    .split(',')
    .map((id: string) => id.trim())
    .filter(Boolean)
    .includes(userId);
}

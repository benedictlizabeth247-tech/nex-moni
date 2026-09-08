# nexMonie — Steps 1–3 Completion Review

## Step 1 — Canonical architecture

**Status: COMPLETE at repository level.**

- Supabase is the only runtime financial backend in the application tree.
- The unused Firebase implementation was removed after confirming there were no application imports outside its own legacy directory and Firebase is not a package dependency.
- A canonical architecture contract is now documented in `ARCHITECTURE_CANONICAL.md`.
- Financial mutations remain behind server/API/database boundaries; the UI was not redesigned.
- `scripts/verify-canonical-architecture.mjs` enforces the boundary.

## Step 2 — Database reproducibility

**Status: HARDENED, but intentionally NOT falsely marked complete.**

The supplied archive does not contain the exact original/base definitions for `profiles`, `wallets`, `wallet_transactions`, and some other pre-existing application tables. Recreating them from inference would be unsafe and violate the project's no-guessing requirement.

Implemented now:

- `supabase/MIGRATION_BASELINE.md` explicitly records the boundary.
- `scripts/verify-migration-chain.mjs` detects the external/base dependencies.
- The repository documents the exact Supabase workflow required to capture the real remote schema: `supabase migration list` → `supabase db pull` → inspect → reset/test → `supabase db push`.
- The migration chain is deterministically ordered and the new hardening migration is timestamped after the existing 2026-08-30 migrations.

**Remaining external action:** pull the schema from the real nexMonie Supabase project. No fabricated schema was added.

## Step 3 — Admin identity and access

**Status: COMPLETE at code/migration level; live-account verification still required.**

- `public.admin_staff` is now the sole runtime authorization registry.
- `/admin` and `/affiliate` are protected server-side through the same `getAdminContext()` boundary.
- Admin order access no longer uses a hard-coded email allowlist.
- The login page no longer decides administrator privileges from email addresses.
- The three designated administrator addresses are retained only inside the database provisioning migration.
- A Supabase Auth trigger provisions/activates the designated accounts in `admin_staff` when those Auth identities exist and deactivates the registry entry if the email changes away from the designated set.
- `admin_staff` is revoked from `anon` and `authenticated` so it remains a server/admin concern.

### Verification performed

- Canonical architecture static verifier: **PASS**.
- Existing repository verifier: **PASS**.
- Withdrawal phases 7–13 verifier: **PASS** after updating it to recognize the canonical admin boundary.
- Migration verifier: **EXPECTED BASELINE REQUIRED** because the exact legacy schema is absent from the supplied archive.
- Full TypeScript/build verification: **NOT RUN** because the environment could not install dependencies; `pnpm` is not installed and Corepack could not reach the npm registry. This is an environment limitation, not a claim of build success.

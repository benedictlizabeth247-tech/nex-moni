# nexMonie — Canonical Architecture Contract

**Effective:** 2026-08-30

This document is the source-of-truth boundary for implementation work. It does not change the existing UI/UX.

## 1. Runtime architecture

```text
Existing Next.js / React UI
        ↓
Next.js Server Components / Route Handlers
        ↓
Supabase Auth + server-side Supabase clients
        ↓
PostgreSQL / RPC / RLS / ledger
        ↓
Operational fulfillment / external rails where explicitly configured
```

Supabase is the canonical financial backend. The browser must not directly mutate financial balances, reservations, settlements, audit records, or administrator state.

## 2. Authentication and authorization

- Supabase Auth is the canonical identity provider.
- Server authorization uses a fresh Auth check (`auth.getUser()`) where a current user record is required.
- `public.admin_staff` is the canonical runtime administrator registry.
- Client-side email lists are not authorization controls.
- The three designated administrator email addresses are provisioned by the database migration/trigger, while the runtime decision is made from `admin_staff.user_id` + `active`.

## 3. Financial boundary

Financial mutations must follow:

`authenticated request → server authorization → database RPC/transaction → wallet/ledger mutation → audit → notification`

The UI is not the authority for balances or transaction state.

## 4. Database source of truth

All schema changes must be represented by ordered `supabase/migrations/*.sql` files. The repository intentionally does **not** invent a missing legacy base schema. The exact pre-existing schema must be captured from the real linked Supabase project with `supabase db pull` before a fresh-database reconstruction can honestly be marked complete.

See `supabase/MIGRATION_BASELINE.md` and `scripts/verify-migration-chain.mjs`.

## 5. Legacy Firebase

The previous Firebase implementation is no longer part of the canonical application tree. The obsolete Firestore helper directory and Firebase-named error-listener artifact were removed during Steps 1–5 hardening. A source verifier blocks Firebase runtime imports from returning.

If a future branch introduces a Firebase dependency, it must be explicitly approved and documented before merging.

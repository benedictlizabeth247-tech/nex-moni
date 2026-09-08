# nexMonie — Steps 1–5 Completion Review

**Date:** 2026-08-30
**Scope:** canonical architecture, migration reproducibility, Admin identity/access, production security boundary, dedicated fiat deposit system.

## Step 1 — Canonical architecture

**Source status: COMPLETE.**

Canonical runtime is:

`Next.js UI → server/API boundary → Supabase Auth/server clients → PostgreSQL/RPC/RLS/ledger → explicitly configured fulfillment rails`

Firebase runtime artifacts were removed from the application tree (`supabase/firestore/*` and the obsolete Firebase-named error-listener component). A source-level verifier confirms there are no Firebase runtime imports.

The repository still contains historical documentation mentioning old providers. Those documents are historical records, not runtime architecture.

## Step 2 — Reproducible database

**Source status: HARDENED; clean-database reconstruction remains BLOCKED on the real remote baseline.**

The repository now has an explicit baseline contract and a deterministic migration verifier. The verifier reports the exact pre-existing dependencies that are not safely reconstructable from this archive alone: `profiles`, `wallets`, and `wallet_transactions`.

Those definitions were intentionally not fabricated. Supabase's current migration workflow requires pulling the actual remote schema with `supabase db pull`, then testing with a clean reset before treating the migration chain as reproducible.

Therefore this step is not falsely marked complete until the actual linked Supabase project is pulled and the resulting baseline is committed.

## Step 3 — Admin identity and access

**Source status: COMPLETE for the current three-admin registry model.**

`public.admin_staff` is the sole runtime administrator registry. Server-side authorization resolves the authenticated user with `auth.getUser()` and checks `admin_staff.user_id + active`.

The three designated identities are provisioned by migration/trigger. Their email addresses are provisioning data only; application authorization does not compare requesters against an email allowlist.

`admin_staff` is not exposed to `anon` or `authenticated`; server-side service-role access is used for the registry lookup.

## Step 4 — Production security boundary

**Source status: HARDENED; live database/RLS verification still required.**

Admin mutations now use the server-side service-role boundary where privileged database functions are required. The Admin order route no longer attempts a privileged RPC through the ordinary authenticated client.

The canonical rule is enforced in source:

`authenticated request → server authorization → privileged RPC/transaction → ledger/state mutation → audit/notification`

Provider funding routes were disabled as production deposit paths. The canonical deposit UI no longer offers Paystack or Stripe funding.

A dedicated source-level verifier checks Firebase absence, registry-based Admin authorization, provider-free canonical deposit UI, and privileged Admin mutation boundaries.

Live verification still requires the actual Supabase project because RLS/grants/function privileges cannot be proven from source files alone.

## Step 5 — Dedicated nexMonie deposit system

**Source status: IMPLEMENTED for manual NGN bank-transfer intake.**

The canonical fiat flow is now:

`User → nexMonie collection bank details → external bank transfer → deposit request/reference → Admin review → atomic credit → ledger/audit/notification`

The user funding screen no longer routes fiat deposits through Paystack or Stripe.

Deposit creation now goes through `/api/deposits/bank`, which authenticates the user server-side and obtains the collection account from `app_config`. The request records the destination-account snapshot, amount, sender bank, reference, proof URL when supplied, and pending status.

The database hardening migration:

- constrains deposit states;
- prevents authenticated clients from updating/deleting deposit records;
- preserves owner-only deposit reads;
- keeps Admin review and credit functions service-role-only;
- keeps the Admin review history protected;
- adds reference indexing;
- records the canonical fiat deposit authority as manual bank-transfer + Admin review.

### Important boundary

Crypto deposit addresses remain a separate custody integration boundary and are not claimed as live on-chain settlement by this step. The current step-5 completion is specifically the NGN/manual-bank-transfer deposit rail.

## Verification performed

- Source-level Steps 1–5 verifier: **PASS**
- Canonical architecture verifier: **PASS**
- Migration-chain verifier: **EXPECTED BLOCKER** — `profiles`, `wallets`, and `wallet_transactions` are pre-existing dependencies and must be captured from the real linked Supabase project.
- Full `pnpm build`: **NOT RUN** because the supplied environment does not contain pnpm/node_modules.
- Live Supabase/RLS/E2E verification: **NOT RUN** because no live project credentials/project reference were supplied in the archive.

## Final status

**Steps 1, 3 and the source implementation of 5 are complete. Step 4 is source-hardened. Step 2 is deliberately not falsely marked complete until the real remote schema baseline is pulled and a clean migration reset succeeds.**

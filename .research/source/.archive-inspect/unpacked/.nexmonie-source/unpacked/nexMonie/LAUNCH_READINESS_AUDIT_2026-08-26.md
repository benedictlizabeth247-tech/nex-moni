# nexMonie Launch Readiness Audit — 2026-08-26 (repair pass)

## Objective
Repair remaining simulated workflows, eliminate fabricated financial/provider outcomes, strengthen the admin-fulfilment path, and perform the strongest verification possible in the current environment without replacing the established Supabase architecture.

## Repaired
- Airtime purchase no longer simulates provider success/failure or mutates the wallet directly. It creates an authenticated `airtime_purchase_requests` record for operations.
- Bills validation no longer invents a customer identity. It validates input format and explicitly marks provider identity as pending operations verification.
- Bill payment no longer displays a fabricated successful settlement. It creates an authenticated `bill_payment_requests` record.
- Scan & Pay no longer contains fake merchants, fake QR decoding, random success rates, or direct client-side wallet mutation. It accepts a nexMonie-compatible QR payload and creates an authenticated `scan_payment_requests` record.
- Fiat deposit no longer falls back to hard-coded collection-bank credentials. It now fails safely until `app_config.bank_details` is configured.
- Added protected `/api/admin/requests` operational queue endpoint for configured administrators. It aggregates data, airtime, bills, scan, send and withdrawal requests using the Supabase service-role key server-side only.
- Affiliate/Admin control now consumes the protected admin queue endpoint instead of reading only the data queue directly from the client.
- Fixed the `WalletTransaction` type import in `services/transaction.service.ts` so the source no longer references a nonexistent export.
- Added `scripts/verify-repo.mjs` for repeatable static verification of required workflows and audited demo markers.

## Existing architecture preserved
- Supabase Auth
- profiles / wallets / wallet_transactions
- existing wallet credit/debit/internal-transfer RPCs
- deposits and deposit-session architecture
- P2P
- internal trading/RPC architecture
- market-data providers/router
- send requests
- data purchase requests
- withdrawal requests

## Current classifications
- Dashboard identity: **REAL**
- Home balance: **REAL**
- Notifications: **REAL**
- Transaction history: **REAL**
- Fiat deposit: **PARTIAL** — requires configured collection account and external confirmation rail.
- Crypto deposit: **PARTIAL** — requires configured deposit addresses and on-chain confirmation/indexing.
- P2P: **PARTIAL** — operational marketplace architecture exists; settlement rail requires configuration.
- Send fiat/crypto: **PARTIAL** — authenticated request rail exists; external settlement remains an operations/provider responsibility.
- Withdraw: **PARTIAL** — authenticated request rail exists; payout execution requires configured rail.
- Data purchase: **PARTIAL** — authenticated admin-fulfilment request rail exists.
- Airtime: **PARTIAL** — authenticated admin-fulfilment request rail replaces fake provider execution.
- Bills: **PARTIAL** — authenticated admin-fulfilment request rail replaces fake provider execution; provider identity/settlement still requires operations.
- Scan & Pay: **PARTIAL** — compatible QR decoding and authenticated request rail exist; merchant settlement requires configured operations/provider rail.
- Admin queue: **PARTIAL** — protected endpoint is implemented; requires `NEXMONIE_ADMIN_EMAIL` (or existing affiliate admin email) and server-only `SUPABASE_SERVICE_ROLE_KEY` in deployment.
- Navigation: **REAL**
- UI proportionality: **PARTIAL** — source corrections exist; device/browser visual QA remains environment-dependent.
- Dark/light profile theme: **REAL/PARTIAL** — profile preference exists; full device-wide visual regression requires browser execution.

## Verification performed in this environment
- `node scripts/verify-repo.mjs` — **PASS**.
- Required workflow files/migrations checked — **PASS**.
- Audited demo-success markers checked — **PASS**.
- TypeScript invocation — **RUN**, but dependency modules are unavailable because `pnpm install --frozen-lockfile` cannot reach the npm registry in this environment. The reported module-resolution failures are environment/dependency-install failures; one independent source error (`WalletTransaction` import) was corrected.
- Production Next.js build — **NOT EXECUTABLE HERE** for the same dependency/network constraint.
- Live Supabase/RLS/RPC verification — **NOT EXECUTABLE HERE** because no connected production Supabase project credentials are available to this runtime.
- Browser/device verification — **NOT EXECUTABLE HERE** because the application dependencies/runtime are unavailable.

## Remaining external prerequisites
These are no longer represented as fake success flows. They are explicit operational prerequisites:
1. Configure real fiat collection/payout rails.
2. Configure real crypto deposit addresses and confirmation/indexing.
3. Configure the external/provider or admin fulfilment process for airtime, bills, scan payments and data.
4. Apply the new migration to the real Supabase project.
5. Configure server-only `SUPABASE_SERVICE_ROLE_KEY` and administrator email for the admin queue.
6. In a networked environment, run `pnpm install --frozen-lockfile`, `pnpm build`, and browser/device regression tests.

## Release decision
The application is **substantially more launch-ready than the previous build**, and all previously identified simulated financial outcomes in the repaired service paths have been removed. The remaining **PARTIAL** classifications are genuine operational integrations, not hidden demos. No claim is made that live provider settlement or production database verification has occurred without the required external credentials/configuration.

# nexMonie Production Funding Implementation — 2026-08-30

Implemented without changing the product's visual design language.

## Deposit
- Added server-side Paystack verification endpoint for the return flow.
- Paystack webhook now handles malformed signature lengths safely.
- Fiat funding remains server-authoritative and credits the wallet through an idempotent database RPC.
- Added controlled Admin review for manual bank-transfer deposit records: approve/credit or reject.
- Added deposit action auditing.
- Crypto deposit address API imports now resolve to the existing services/custody/index.ts module.
- The customer crypto funding screen first requests a configured custody address and falls back to existing app_config addresses.

## Admin wallet funding
- Replaced the previous hard-coded sandbox-only admin credit path.
- Added production admin wallet funding/debit RPC.
- Supports NGN and USD when the customer's wallet is denominated in the selected currency.
- Uses row locking and an atomic wallet transaction.
- Records every adjustment in wallet_transactions and admin_wallet_adjustments.
- Admin identity is checked through the server boundary and an admin_staff table.
- Existing visual credit form was retained; it now performs production wallet adjustments.

## Admin access
- Added server-side /admin layout protection using the authenticated admin_staff registry.
- Existing admin APIs continue to require approved staff authentication.
- Added payment-intent and wallet-adjustment data to the admin operational aggregation.

## Build safety
- Removed Next.js `typescript.ignoreBuildErrors`.
- No secrets were added.
- Fixed the custody module import target.

## Verification limitation
The supplied repository snapshot does not contain node_modules and this environment cannot reach the npm registry, so a real `pnpm install --frozen-lockfile` / Next production build could not be executed here. A raw TypeScript invocation therefore reports missing installed dependencies plus pre-existing project errors; it is not a valid production-build result. The changed source and SQL were statically inspected.

## Required production configuration
Before real deposits can settle, configure:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- PAYSTACK_SECRET_KEY
- NEXT_PUBLIC_APP_URL

For crypto deposits also configure:
- NEXMONIE_CUSTODY_BASE_URL
- NEXMONIE_CUSTODY_API_KEY

Apply all Supabase migrations, including:
`supabase/migrations/20260830_production_funding_and_admin_controls.sql`

Do not use test/demo credentials for production money movement.

## Withdrawal Phase 1 — Atomic Reservation (2026-08-30)

Implemented without changing the existing UI/UX.

- Added `supabase/migrations/20260830_withdrawal_atomic_reservation.sql`.
- Expanded the existing withdrawal request contract to support all destination types already exposed by the existing UI and added `failed` lifecycle status.
- Added idempotency, network, autopilot, reservation, settlement/release timestamps and failure metadata.
- Added a unique per-user idempotency index.
- Added `public.create_withdrawal_request(...)` as a security-definer RPC callable by authenticated users.
- The RPC authenticates with `auth.uid()`, locks the user's wallet row with `FOR UPDATE`, validates wallet status/currency/available balance, atomically reduces `available`, creates the withdrawal request, and creates a pending withdrawal ledger transaction in the same database transaction.
- Repeated submissions using the same idempotency key return the existing request instead of reserving funds twice.
- Updated `services/withdrawal.ts` to use the RPC instead of direct client-side insertion.
- No external payout is executed in this phase. The reserved amount remains owned by the withdrawal request until the later payout settlement/release phase.
- No customer or Admin UI was redesigned or changed.

Validation note: the supplied environment does not have `pnpm`/installed dependencies, so a TypeScript production build could not be run locally in this environment. The implementation was reviewed statically and the migration/service contracts were checked for consistency.

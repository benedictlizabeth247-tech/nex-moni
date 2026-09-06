# nexMonie Withdrawal Phases 3 & 4 — 2026-08-30

## Phase 3 — Real bank-account verification

The previous fabricated resolver was replaced with an authenticated server-only Paystack account-resolution call. It requires `PAYSTACK_SECRET_KEY`, validates a Nigerian 10-digit account number and bank code, calls Paystack `GET /bank/resolve`, and returns only the provider-verified account name/details. No fake account name or simulated delay remains.

Paystack documents NGN account resolution as the verification step before creating a transfer recipient.

## Phase 4 — Admin withdrawal operations

Added a Supabase-backed administrator withdrawal state machine. Approved staff can approve, reject, hold, and resume a reserved withdrawal. Rejection atomically restores the reserved wallet amount and records a release transaction. Approval moves the request to processing but deliberately does NOT send external money yet; provider payout execution and final webhook settlement are the next phase.

The existing Admin and customer visual language was preserved. The new controls are operational additions to the existing withdrawal module rather than a redesign.

## Required production configuration

- `PAYSTACK_SECRET_KEY` must be configured server-side.
- Paystack account resolution must be enabled for the business account.
- Bank codes must come from the operational bank directory.
- External payout execution is intentionally deferred to the next withdrawal phase.

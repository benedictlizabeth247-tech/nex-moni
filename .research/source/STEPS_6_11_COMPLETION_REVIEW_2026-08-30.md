# nexMonie — Steps 6–11 Completion Review

Date: 2026-08-30

## Scope

This cycle hardens the financial path without redesigning the existing UI:

6. Deposit verification and settlement
7. Atomic withdrawal reservation
8. Atomic successful withdrawal settlement
9. Atomic withdrawal failure/reversal/release
10. Internal nexMonie transfers
11. Crypto withdrawal settlement boundary

## Results

### 6 — Deposit verification and settlement

**Status: A — CODE VERIFIED / HARDENED**

- Dedicated manual bank-transfer deposit remains authoritative.
- Admin review is server-side and service-role-only.
- Deposit evidence is visible to Admin: destination bank/account, sender bank, amount, reference, proof URL and review state.
- Approve and reject require a review action; rejection requires a reason in the Admin UI.
- Deposit settlement is idempotent by settlement reference through the ledger.
- Deposit records now retain `currency`, `reviewed_at`, `reviewed_by`, `review_note` and `settlement_reference`.
- Customer notification and financial audit events are emitted from the database transaction.

### 7 — Atomic withdrawal reservation

**Status: A — CODE VERIFIED**

The existing reservation path remains authoritative: the wallet row is locked and the requested amount is removed from `available` before the withdrawal request and pending ledger reservation are created. Idempotency is enforced for repeated request keys.

### 8 — Atomic successful settlement

**Status: A — CODE VERIFIED / HARDENED**

- Only `processing + reserved` withdrawals can settle.
- The original pending withdrawal ledger row must transition exactly once.
- A second settlement attempt fails rather than posting a second completion.
- Reservation becomes `settled` only after the ledger transition succeeds.
- Audit and customer notification are emitted.

### 9 — Atomic failure/reversal/release

**Status: A — CODE VERIFIED / HARDENED**

- Only active reserved withdrawals can fail/release.
- Wallet is row-locked before the reservation is returned to `available`.
- Exactly one pending withdrawal ledger row must be converted to failed.
- A release transaction is created.
- Reservation becomes `released`.
- Reason, audit and notification are retained.
- `on_hold` is part of the authoritative withdrawal state constraint.

### 10 — Internal nexMonie transfers

**Status: A — CODE VERIFIED / HARDENED**

- Authenticated user only.
- Recipient cannot be the sender.
- Both wallets must exist and be active.
- Wallet locks use deterministic ID ordering to reduce opposite-direction deadlock risk.
- Sender debit and recipient credit occur in one database transaction.
- Idempotency key is mandatory and uniquely constrained per sender.
- A concurrent unique-key race returns the original transfer rather than creating a second debit.
- Both ledger entries, audit and notifications are created atomically.

### 11 — Crypto withdrawal settlement

**Status: A — CODE VERIFIED / LIVE RAIL UNVERIFIED**

- Custody adapter remains server-side.
- Withdrawal submission requires `processing + reserved` state.
- Provider reference and provider status are persisted.
- A second custody submission is rejected/idempotently reported once a provider reference exists.
- Provider submission is audited.
- The system does **not** claim blockchain completion merely because submission succeeded.

The actual custody provider remains intentionally unverified until its real base URL/API key and controlled test transaction are available.

## Verification performed

- Steps 1–5 verifier: PASS.
- Canonical architecture verifier: PASS.
- Withdrawal phases 7–13 verifier: PASS (18 checks).
- New Steps 6–11 verifier: PASS (14 checks).
- Next.js production build: **NOT RUN** — dependencies are not installed in this working environment.
- Live Supabase execution: **NOT RUN** — no live project credentials were supplied to this archive.

## Release classification

These steps are **source-verified (A)**, not falsely labelled as live end-to-end verified (C).

Supabase's current guidance recommends testing RLS/function behavior with database tests and resetting a local database from the complete migration chain before declaring the database reproducible. The next verification stage must therefore execute the migration chain against a disposable/staging Supabase database and run the financial concurrency/replay tests.

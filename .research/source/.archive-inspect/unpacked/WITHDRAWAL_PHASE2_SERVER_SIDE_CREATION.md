# nexMonie Withdrawal Phase 2 — Server-Side Withdrawal Creation

## Scope
The customer withdrawal request now enters a Next.js Route Handler, is authenticated with the user's Supabase session, validated server-side, and passed to the existing atomic Supabase database function.

## Flow
User UI → POST `/api/withdrawals` → Supabase server client/session → `create_withdrawal_request` RPC → wallet row lock → balance reservation → withdrawal request + pending ledger transaction.

The UI was not redesigned.

## Security boundary
The browser no longer calls the withdrawal RPC directly. The route handler establishes the authenticated user with the server-side Supabase client. The database function independently uses `auth.uid()` and therefore does not trust a user ID supplied by the browser.

## Important
This phase does not execute an external bank/crypto payout. Funds are reserved until a later payout/settlement phase explicitly settles or releases the reservation.

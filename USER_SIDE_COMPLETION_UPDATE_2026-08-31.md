# nexMonie User-Side Completion Update — 2026-08-31

Based on the latest `nexMonie-live-funding-transfer-complete.zip` baseline.

## Implemented

- Internal nexMonie transfers are explicitly submitted as USDT from the user UI; the existing database RPC already enforces USDT, atomic debit/credit, deterministic locking and idempotency.
- User wallet/home/profile/transactions/withdrawal/asset displays were aligned to USDT instead of treating the funding wallet as NGN and converting it to USD.
- Admin user credit controls were aligned to USDT. The existing privileged `admin_fund_wallet` RPC already enforces USDT, atomic balance mutation, ledger entry, audit record and notification.
- Request Money now calls the existing `create_money_request` RPC instead of only changing local UI state; the RPC records a USDT request and notifies the recipient.
- P2P marketplace now uses the secure `p2p_create_trade`, `p2p_mark_paid` and `p2p_cancel_trade` RPCs rather than direct client-side status/balance mutations.
- P2P listings are restricted to the currently supported USDT rail in the user marketplace UI.
- P2P advertisement creation now reserves the advertiser's USDT atomically; listing cancellation releases the remaining reservation; active trades prevent unsafe listing cancellation.
- P2P trade chat is now backed by `p2p_trade_messages` and a secure `p2p_send_trade_message` RPC with realtime updates.
- Seller-side P2P release is available through the secure `p2p_release_trade` RPC after payment is marked.
- Removed hard-coded fake seller bank details from the active trade UI; unavailable bank details are no longer fabricated.
- Added a real user support conversation flow: create ticket, view tickets, reply, realtime message updates.
- Added a protected support inbox for the existing staff surface: view tickets, reply, close tickets, realtime updates.
- Added Support to the existing operations navigation.

## Verified against the connected Supabase project

- `admin_fund_wallet` currently enforces `USDT`.
- `create_internal_transfer` currently enforces `USDT` and performs atomic internal transfer with idempotency.
- `create_money_request` already exists and returns/records `USDT` requests.
- P2P application/listing/trade lifecycle functions now exist in the connected project.
- P2P trade chat function now exists in the connected project.
- The connected project currently reports USDT wallets for the inspected wallet rows; no NGN wallet row was returned by the wallet inspection.

## Important remaining limitation

The source archive could not be fully dependency-installed/built in this environment because the package registry was unreachable. Global TypeScript checking therefore reports many pre-existing missing-module errors (`next`, `react`, Supabase packages, etc.) rather than proving a clean production build. The modified source itself was inspected and `git diff --check` produced no whitespace errors.

External service requests (airtime/data/bills/scan and bank/external crypto payout) remain request/operations rails rather than fabricated instant settlement. They must not be represented as successfully fulfilled until their configured operational provider/settlement path confirms completion.

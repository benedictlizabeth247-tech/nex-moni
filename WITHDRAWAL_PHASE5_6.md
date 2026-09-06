# nexMonie Withdrawal Phases 5 & 6

## Phase 5 — Manual operational fulfillment

The approved/processing withdrawal is now a real nexMonie operational order. No Paystack, Flutterwave, Monnify, or other payout API is required. The admin fulfills the external bank/cash/other destination outside the application and then records the actual outcome inside the existing Admin UI.

`processing -> completed` consumes the existing wallet reservation. It does **not** debit the wallet a second time.

## Phase 6 — Failure/reversal settlement

If the external fulfillment fails, Admin records `failed` with a mandatory reason. The backend atomically:

1. locks the withdrawal;
2. locks the customer's wallet;
3. releases the reserved amount back into `available`;
4. creates a completed release ledger transaction;
5. marks the original withdrawal ledger transaction failed;
6. marks the withdrawal request failed/released;
7. records the administrator and failure reason.

The UI is unchanged; only the operational controls behind the existing Admin withdrawal module were completed.

## State machine

`pending -> processing -> completed`

`pending -> rejected -> released`

`processing -> on_hold -> processing -> completed`

`processing -> failed -> released`

No path is allowed to settle an already released reservation or to debit the wallet twice.

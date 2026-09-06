# Live funding and internal transfer

The current build contains a privileged wallet adjustment flow for the existing staff-only operations area and an authenticated internal transfer flow.

## User funding

The user detail view already contains a wallet credit/debit form. Positive amounts increase the selected NGN/USD wallet; negative amounts reduce available balance. The operation is performed by the server through `admin_fund_wallet`, locks the wallet balance row, prevents a negative resulting balance, writes a wallet transaction, and records the adjustment with actor, reason and before/after balances.

The privileged function is executable only by `service_role`; the API first verifies the signed-in account against `admin_staff`. The normal user-facing application contains no funding-control UI.

## Internal nexMonie transfer

`create_internal_transfer` settles an authenticated user-to-user transfer atomically in PostgreSQL. The recipient can be resolved by email or username. Both wallet balance rows are locked before mutation, insufficient funds and self-transfers are rejected, both sides receive ledger transactions, and the supplied idempotency key prevents a replay from creating a second transfer.

## Deployment note

The live Supabase project has the required runtime tables and RPCs. The exact designated staff identities must exist in `admin_staff` before the privileged operation can be used; no credentials are invented or created by this build.

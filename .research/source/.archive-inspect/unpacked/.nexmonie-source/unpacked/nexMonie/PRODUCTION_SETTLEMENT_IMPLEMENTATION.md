# nexMonie — Production Settlement Implementation

This build keeps the existing Supabase architecture and adds real server-side settlement/execution boundaries.

## Implemented
- Live market order execution now resolves a fresh market quote on the server before the order RPC; the browser cannot supply the execution price.
- Trading execution is persisted to the exchange ledger with an execution reference.
- Fiat funding has a real Paystack initialization path and a signature-verified webhook that re-verifies the transaction before crediting the user's wallet.
- Crypto custody is isolated behind a server-only custody adapter for deposit-address issuance, withdrawals and deposit verification. No fake address or fake blockchain confirmation is generated.
- Service-role credentials are never exposed to browser code.
- Existing market-data providers remain market-data only; they are not treated as nexMonie custody providers.

## Production configuration required
The application cannot legally or technically settle real external money without credentials/accounts at the settlement providers. Configure these server-only variables:

- `SUPABASE_SERVICE_ROLE_KEY`
- `PAYSTACK_SECRET_KEY`
- `NEXT_PUBLIC_APP_URL`
- `NEXMONIE_CUSTODY_BASE_URL`
- `NEXMONIE_CUSTODY_API_KEY`
- `NEXMONIE_ADMIN_EMAIL`

Apply:

`supabase/migrations/20260826_production_settlement_and_execution.sql`

before using production settlement.

The Paystack path follows Paystack's current server-side initialize/verify model and uses webhook verification before value is credited. The crypto custody boundary intentionally requires a real custody provider endpoint rather than inventing blockchain addresses or private-key storage inside the frontend repository.

## Verification performed locally
- `node scripts/verify-repo.mjs` — PASS
- Repository route/source audit — PASS
- No dependency installation was performed because the current environment has no installed `node_modules` and package-registry access is not available here.
- A real production payment/webhook/custody verification requires the corresponding production credentials and network-accessible provider accounts; those are not present in the repository and were not fabricated.

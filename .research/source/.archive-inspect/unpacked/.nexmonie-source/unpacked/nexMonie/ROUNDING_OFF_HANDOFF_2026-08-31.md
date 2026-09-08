# nexMonie rounding-off handoff — 2026-08-31

This archive is based on the most recent rounding-off NexMonie project artifact and preserves the existing application architecture.

## Final correction in this pass

The Home **Quick Actions** gesture was directionally wrong: the previous implementation opened Utilities Hub on a right swipe and also allowed the Home-level swipe handler to consume the gesture. It is now explicitly **left-swipe only**. Quick Actions stop propagation of the touch gesture, use a predominantly-horizontal left threshold, animate the Quick Actions surface, and then open `/utilities-hub`. Right swipes are ignored. Taps still open the selected action.

The Utilities Hub remains the existing mini-app surface with the previously implemented service experiences.

## Security hardening included

- Admin runtime authorization is registry-based through `public.admin_staff`; application runtime no longer contains a client-side hardcoded administrator allowlist.
- Admin sign-in authenticates with Supabase and then performs a server-side `/api/admin/session` authorization check before entering `/admin`.
- Password recovery checks the server-side admin registry before requesting the Supabase recovery email.
- Recovery callback and password update re-check the authenticated session against `admin_staff`.

## Market/chart integrity

The existing provider architecture is preserved. Crypto candles use Bybit first, then OKX, then CoinGecko. Non-crypto candles use the existing Yahoo/keyed-provider chain, keyless historical FX fallback, and the existing CNBC tracking-instrument fallback for supported indices/commodities. The market detail UI reports the provider returned by the chart API; no generated or synthetic candles are introduced.

## NexWallet identity

The existing Supabase migration `20260831120000_user_identity_and_operational_rails.sql` remains authoritative for unique 10-digit `nex_user_id` generation, backfill, validation, persistence, and internal-transfer lookup.

## Verification

Run:

`npm run verify:final-rounding`

and the existing verification scripts before deployment. The local environment used for this handoff did not contain installed project dependencies, so a production Next.js build could not be executed locally without downloading packages. The archive itself contains the project lockfile and all existing source/migration verification scripts.

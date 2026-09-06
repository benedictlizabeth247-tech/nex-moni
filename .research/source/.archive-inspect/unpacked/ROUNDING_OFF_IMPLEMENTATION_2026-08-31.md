# NexMonie Rounding-Off Implementation — 2026-08-31

This package is based on `nexMonie-FINAL-OPERATIONAL-READY-2026-08-31.zip` and applies the requested final corrections without replacing the existing application.

## Implemented

- Real market-chart routing: crypto candles use Bybit → OKX → CoinGecko; non-crypto history preserves Yahoo/keyed providers and now explicitly invokes the keyless forex history provider before the final fallbacks.
- Frankfurter v2 is used for genuine daily FX history; it is keyless and currently documents broad central-bank coverage including CBN/NGN.
- CNBC's existing real tracking-instrument proxies are now usable for both index and commodity chart fallback paths.
- Candle API normalization now recognizes known crypto, forex, ETF, index, commodity, and stock symbols when a raw symbol is supplied instead of a canonical `type.symbol` ID.
- NexWallet/nexMonie user ID remains backed by the existing Supabase migration: every profile receives a unique 10-digit numeric ID, persisted and unique.
- Quick Actions is now horizontally swipeable, and a right swipe opens the existing Utilities/Mini Apps Hub. A direct CTA is also provided so the hub is reachable even on devices with weak touch gestures.
- Email Support now opens the dedicated second-step Admin Login.
- Admin Login is limited to the three approved emails and then relies on the existing server-side `admin_staff` authorization before `/admin` is allowed.
- Forgot-password and secure Supabase recovery/update-password screens were added for the approved admin accounts.
- Existing Admin Dashboard and admin API architecture were preserved.

## Important deployment requirement

The application still requires the connected Supabase environment variables and the existing database migrations/admin_staff records in the target Supabase project. This package does not invent or embed service-role secrets.

The local environment used for this packaging run did not have network access to npm, so a full production `pnpm build` could not be executed here. The source was inspected and the archive was packaged after the code changes; Replit should run its normal install/build checks before publishing.

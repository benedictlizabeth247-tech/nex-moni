# nexMonie/VU Exchange Implementation Update — 25 Aug 2026

## Implemented
- Added an internal exchange execution layer backed by Supabase RPCs/tables.
- Added Funding, Spot and Futures trading-account balances.
- Added Funding → Spot/Futures transfers.
- Added internal Spot and Futures order placement using the selected market price from the existing market-data layer.
- Added open-position monitoring, order history and position close flow.
- Added unrealized/realized P&L calculation in the internal engine.
- Added downloadable P&L image snapshots.
- Added pair search/selection across the existing market-search architecture; users are not locked to BTC/USDT.
- Added an Assets overview showing Funding, Spot and Futures balances.
- Added protected Affiliate Control route using NEXT_PUBLIC_AFFILIATE_ADMIN_EMAIL as the configured administrator identity.
- Improved trading visuals to a mature green / off-white / neutral-grey palette; no black Home background was introduced.
- Preserved the existing market feed/provider architecture.

## Research basis
The account structure and workflow were informed by current Bybit documentation: Funding Account for deposits/withdrawals, UTA-style trading account organization, Spot/Futures trading, order/position monitoring, Convert, Alpha, Copy Trading, and Learn/Trade education patterns. The implementation uses those concepts as product references rather than copying Bybit branding or proprietary assets.

## Important deployment requirement
Apply `supabase/migrations/20260825_internal_exchange_engine.sql` to the project's Supabase database before using internal order execution. The application intentionally does not invent balances, positions or P&L in the frontend.

## 2026-08-25 — Trading lifecycle upgrade
- Added per-position take-profit and stop-loss controls for Spot and Futures.
- Added live position marking against the existing market-data feed so each open position can update independently.
- Added individual position close and realized P&L persistence.
- Added pending-order cancellation.
- Added multiple independent filled positions instead of silently merging Futures positions.
- Added closed-position history alongside order history.
- Added per-position P&L snapshot sharing/download using PNG files.
- Added equity display combining trading balance and unrealized P&L.
- Preserved existing market-data providers and read-only market feed architecture.

- 2026-08-25: Reworked Fund into a Funding Account entry with Crypto, Fiat and P2P choices; added clear on-chain asset/network selection, configured-wallet-only address rendering, fiat deposit amount keypad, and operational deposit review flow.
- 2026-08-25: Reworked Send Money into nexMonie/Fiat/Crypto rails with a large blue amount-entry keypad inspired by the supplied Autopilot reference; added send_requests persistence so requests are recorded rather than simulated.

- 2026-08-26: Reworked Funding and Send amount-entry UX with a reusable, full-width blue amount keypad/display inspired by the supplied Autopilot reference while preserving nexMonie branding. Funding now presents P2P, Crypto and Fiat as explicit first-class methods; fiat uses the operational deposit-session flow, crypto uses configured asset/network addresses without inventing addresses, and P2P routes to the existing P2P marketplace. Replaced the old fake transfer API behavior with an authenticated Supabase request rail that records send intent instead of randomly claiming external execution.

## 2026-08-26 — Exchange UX / Funding / Proportionality Repair Pass

- Restored the Home horizontal swipe/pager interaction and added a direct service panel without replacing vertical scrolling.
- Changed Home Fund entry points to the canonical `/fund` route and preserved the existing `/fund-account` implementation as its underlying workflow.
- Reworked Fund presentation around three explicit funding paths: P2P, Crypto and Fiat, using the existing Supabase deposit/session architecture.
- Added configured-address QR presentation for crypto deposits; no wallet address is fabricated when operational configuration is absent.
- Improved the numeric amount-entry component with a dominant, Autopilot-inspired blue amount surface, clear currency, available balance/quick amounts and full-width numeric keypad proportions.
- Expanded Home quick actions to include Fund, Send Money, Receive, Airtime, Data, Scan & Pay, Bills, Withdraw, P2P and More while preserving existing routes.
- Restyled core Home/Fund/market surfaces toward the approved coral + ash visual direction instead of the previous white/green template treatment.
- Added canonical crypto asset icon identity to the market-data contract and enriched resolved quotes from the existing market engine so the UI can show recognizable asset imagery without changing market-data providers.
- Added asset identity imagery to Market Overview, Home Markets and Market Detail screens.
- Kept Bybit/OKX/CoinGecko/Yahoo/Finnhub/Twelve Data/Polygon/Nasdaq/CNBC/ExchangeRate as market-data infrastructure only; no external provider is treated as nexMonie custody or execution.
- Kept financial mutations on the existing Supabase/RPC/request architecture; no client-side wallet balance mutation was introduced.

## Steps 12-22 — 2026-08-30
- Autopilot routing is an explicit authenticated pending→processing transition and never settles funds.
- Trading execution now has one authenticated RPC signature including TP/SL; execution checks auth.uid(), account restrictions and uses an atomic transaction boundary.
- Trading account reads no longer mirror the ordinary wallet into spot/futures balances; `trading_accounts` is the trading authority and wallet remains the funding source.
- Added trading-to-funding return path and exchange ledger records for execution/fill/close operations.
- Added real wallet-funded NexPilot copy allocations; removed the legacy $2-credit gate and wired Start Copy Trading to the allocation endpoint.
- Merchant registration no longer self-approves or seeds a merchant profile; admin approval is required before merchant activation.
- Added admin merchant review and service fulfillment state-machine RPCs with audit + notification records.
- Added bank withdrawal beneficiary/fulfillment fields; no provider account-resolution is required by the withdrawal architecture.
- Added admin wallet freeze/unfreeze, withdrawal/trading restrictions and reconciliation controls.
- Added admin operational endpoints and connected service/merchant controls to the existing Admin interface.
- Added `admin_settle_order` as an authoritative state/audit operation for the legacy Admin order queue; it does not fabricate wallet value.

## 2026-08-31 — Operational identity and rail readiness
- Added unique 10-digit server-generated `profiles.nex_user_id` for internal transfers.
- Added collision-safe generation, validation trigger and unique index.
- Internal transfer lookup now accepts `nex_user_id` in addition to existing identifiers.
- Removed a hard-coded P2P bank account from the order UI; merchant payment details must be configured by the actual merchant/order rail.
- Added `operational_rail_config` for founder-supplied bank accounts, crypto addresses, fees and commissions; no live values are fabricated.
- Updated user search/send UI to recognize the 10-digit nex ID.

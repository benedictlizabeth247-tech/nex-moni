# nexMonie — Operational Configuration Handoff

This build adds the remaining founder-supplied operational configuration contracts without inventing live values.

## 1. Ten-digit nexMonie User ID

Every `profiles` row receives a unique `nex_user_id`:

- exactly 10 decimal digits
- first digit is 1–9 (never starts with zero)
- generated server-side using cryptographically random bytes
- never derived from phone number, email, auth UUID, or registration number
- unique database index prevents duplicates
- database trigger assigns IDs automatically to new profiles
- existing profiles are backfilled once by the migration
- internal transfers accept this ID as the primary human transfer identifier
- the auth UUID remains internal and is never exposed as the transfer ID

The ID is intentionally not predictable or sequential. Collision handling occurs inside the database before assignment.

## 2. Bank configuration still required from founder

No bank account details were invented. Before live fiat deposits/withdrawals are enabled, provide:

- receiving bank name
- receiving account number(s)
- receiving account name
- currency
- Monnify contract code
- Monnify API credentials (stored as server-side environment secrets)
- reserved-account strategy (one account per customer or approved alternative)
- withdrawal settlement account/rail
- applicable deposit/withdrawal fees and commissions

Monnify's current documentation supports reserved accounts that associate incoming transfers with a customer reference and provides account-name enquiry for destination verification. See official documentation before enabling live values.

## 3. Crypto configuration still required from founder

No wallet address was invented. Before live crypto deposits/withdrawals are enabled, provide/configure:

- asset (for example USDT)
- network (for example TRON/ETH/BSC/etc.)
- official deposit address per network
- memo/tag where required
- confirmation policy
- minimum deposit
- minimum withdrawal
- network fee
- nexMonie withdrawal fee
- platform commission, if any
- custody/provider endpoint and credentials

The application continues to fail closed when the custody rail is not configured.

## 4. Trading

The existing trading implementation remains unchanged by this identity/rail handoff. Spot/futures/copy-trading balances and settlement remain server/database controlled. Provider market feeds are not treated as custody.

## 5. No fake production values

The migration creates `operational_rail_config` as the controlled storage contract, but leaves live bank/crypto/fee records inactive and empty until the founder supplies the real values. This prevents the application from displaying invented account numbers, wallet addresses or fee schedules.

import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const failures = []
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const exists = (file) => fs.existsSync(path.join(root, file))
const assert = (condition, message) => { if (!condition) failures.push(message) }

// 1/2/7 — real market routing and chart source chain.
const router = read('services/market-data/router.ts')
const candles = read('app/api/market/candles/route.ts')
const detail = read('app/markets/[id]/page.tsx')
assert(router.includes("bybit.getKline(ref.symbol, timeframe)"), 'Crypto chart chain missing Bybit primary.')
assert(router.includes("okx.getKline(ref.symbol, timeframe)"), 'Crypto chart chain missing OKX fallback.')
assert(router.includes("coingecko.getCandles(ref.symbol, timeframe)"), 'Crypto chart chain missing CoinGecko fallback.')
assert(router.includes('exchangerate.getCandles(ref.type, ref.symbol, timeframe)'), 'Forex historical fallback missing.')
assert(router.includes('cnbc.getCandles(ref.type, ref.symbol, timeframe)'), 'Index/commodity chart fallback missing.')
assert(candles.includes('getCandles(normalizedId, timeframe)'), 'Candle API is not wired to the market router.')
assert(detail.includes('useCandles(id, timeframe)'), 'Market detail is not wired to the candle hook.')
assert(detail.includes('Source: {chartProvider}'), 'Market detail does not expose the actual chart provider.')

// 3 — durable 10-digit NexMonie identity.
const identityMigration = read('supabase/migrations/20260831120000_user_identity_and_operational_rails.sql')
const walletService = read('services/walletService.ts')
assert(identityMigration.includes("new.nex_user_id !~ '^[1-9][0-9]{9}$'"), 'NexMonie ID is not enforced as exactly 10 digits.')
assert(identityMigration.includes('create unique index if not exists profiles_nex_user_id_unique_idx'), 'NexMonie ID uniqueness index missing.')
assert(identityMigration.includes('where nex_user_id is null'), 'Existing profiles are not backfilled.')
assert(walletService.includes('nexId: profile.nex_user_id'), 'NexWallet is not displaying the persisted NexMonie ID.')

// 4 — Quick Action must own a left-only gesture and not bubble into Home pager.
const quick = read('components/dashboard/QuickActionGrid.tsx')
assert(quick.includes("deltaX < -70"), 'Quick Action left swipe threshold missing.')
assert(quick.includes('event.stopPropagation()'), 'Quick Action gesture can still bubble to the Home pager.')
assert(quick.includes("router.push('/utilities-hub')"), 'Quick Action does not open Utilities Hub.')
assert(quick.includes('Swipe ← for services'), 'Quick Action direction label is not left-facing.')
assert(!quick.includes('if (delta > 90)'), 'Quick Action still contains the old right-swipe navigation.')
assert(exists('app/utilities-hub/page.tsx'), 'Utilities Hub page is missing.')

// 5/6 — server-authorized admin route + Supabase recovery.
const admin = read('lib/admin.ts')
const adminSession = read('app/api/admin/session/route.ts')
const adminLogin = read('app/admin-login/page.tsx')
const recovery = read('app/admin-login/forgot-password/page.tsx')
const update = read('app/auth/update-password/page.tsx')
const callback = read('app/auth/callback/route.ts')
assert(admin.includes(".from('admin_staff')"), 'Admin authorization is not registry-based.')
assert(adminSession.includes('getAdminContext()'), 'Admin session endpoint does not use server authorization.')
assert(adminLogin.includes("fetch('/api/admin/session'"), 'Admin login does not perform server-side authorization after password sign-in.')
assert(recovery.includes("/api/admin/recovery"), 'Password recovery does not verify admin registry server-side.')
assert(recovery.includes('resetPasswordForEmail'), 'Supabase recovery email is not wired.')
assert(update.includes("fetch('/api/admin/session'"), 'Password update does not re-check admin authorization.')
assert(update.includes('updateUser({password})'), 'Supabase password update is missing.')
assert(callback.includes('exchangeCodeForSession(code)'), 'Supabase recovery callback is missing code exchange.')

if (failures.length) {
  console.error('FINAL ROUNDING CHECK: FAIL')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}
console.log('FINAL ROUNDING CHECK: PASS')
console.log('1/2/7 market charts: real provider chains and source reporting present')
console.log('3 NexWallet: persistent unique 10-digit identity contract present')
console.log('4 Quick Action: left-only swipe -> Utilities Hub with event isolation present')
console.log('5/6 Admin: server registry authorization and Supabase recovery present')

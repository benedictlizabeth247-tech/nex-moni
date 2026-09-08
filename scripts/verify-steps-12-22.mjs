import fs from 'node:fs'
import path from 'node:path'
const root=process.cwd()
const must=[
 ['migration','supabase/migrations/20260831020000_steps_12_22_exchange_operations.sql'],
 ['trading route','app/api/trading/execute/route.ts'],
 ['autopilot route','app/api/withdrawals/autopilot/route.ts'],
 ['copy route','app/api/finances/copy-trade/route.ts'],
 ['merchant service','services/merchantService.ts'],
 ['admin operations route','app/api/admin/operations/route.ts'],
 ['admin wallet controls route','app/api/admin/wallet-controls/route.ts'],
]
for(const [label,file] of must){if(!fs.existsSync(path.join(root,file))) throw new Error(`${label} missing: ${file}`)}
const sql=fs.readFileSync(path.join(root,'supabase/migrations/20260831020000_steps_12_22_exchange_operations.sql'),'utf8')
for(const token of ['route_autopilot_withdrawal','trading_execute_order','trading_get_account','trading_transfer_to_funding','trading_fill_order','trading_close_position','create_copy_trade_allocation','admin_review_merchant_application','admin_fulfill_service_request','admin_set_wallet_controls','admin_reconcile_wallet','admin_settle_order','admin_fulfill_service_request','admin_review_merchant_application']) if(!sql.includes(token)) throw new Error(`missing SQL contract: ${token}`)
const copy=fs.readFileSync(path.join(root,'app/api/finances/copy-trade/route.ts'),'utf8'); if(copy.includes('no more than the available $2')||copy.includes('> 2')) throw new Error('legacy $2 copy-trade guard remains')
const merchant=fs.readFileSync(path.join(root,'services/merchantService.ts'),'utf8'); if(merchant.includes("status: 'approved'")) throw new Error('merchant service still self-approves')
const trading=fs.readFileSync(path.join(root,'app/api/trading/execute/route.ts'),'utf8'); if(!trading.includes('p_take_profit')||!trading.includes('p_stop_loss')) throw new Error('trading TP/SL RPC parameters missing')
console.log('Steps 12-22 source verification: PASS')

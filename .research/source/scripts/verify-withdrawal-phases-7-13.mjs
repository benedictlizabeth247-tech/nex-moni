import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const required = [
  'supabase/migrations/20260830_withdrawal_phases_7_13.sql',
  'app/api/transfers/internal/route.ts',
  'app/api/withdrawals/autopilot/route.ts',
  'app/api/admin/withdrawals/crypto/route.ts',
  'app/api/notifications/route.ts',
  'app/api/notifications/read/route.ts',
]
const checks = []
for (const f of required) checks.push([f, fs.existsSync(path.join(root, f))])

const migration = fs.readFileSync(path.join(root, required[0]), 'utf8')
for (const token of [
  'admin_settle_withdrawal', 'admin_fail_withdrawal', 'create_internal_transfer',
  'admin_record_crypto_submission', 'route_autopilot_withdrawal', 'financial_audit_log',
  'notifications', 'verify_withdrawal_invariants', 'withdrawal.resumed',
]) checks.push([`migration:${token}`, migration.includes(token)])

const actions = fs.readFileSync(path.join(root, 'components/admin/withdrawal-actions.tsx'), 'utf8')
checks.push(['admin_ui_resume_action', actions.includes("run('resume')")])

const adminRequests = fs.readFileSync(path.join(root, 'app/api/admin/requests/route.ts'), 'utf8')
checks.push(['admin_queue_uses_admin_staff', adminRequests.includes("from('admin_staff')") && !adminRequests.includes('function isAdmin')])

const adminOrders = fs.readFileSync(path.join(root, 'app/api/admin/orders/route.ts'), 'utf8')
checks.push(['admin_orders_uses_canonical_admin_context', adminOrders.includes("from '@/lib/admin'") && adminOrders.includes('getAdminContext') && !adminOrders.includes('function isAdmin')])

const bad = checks.filter(([, ok]) => !ok)
if (bad.length) {
  console.error('FAIL', bad)
  process.exit(1)
}
console.log(`PASS: withdrawal phases 7-13 implementation surface verified (${checks.length} checks)`)

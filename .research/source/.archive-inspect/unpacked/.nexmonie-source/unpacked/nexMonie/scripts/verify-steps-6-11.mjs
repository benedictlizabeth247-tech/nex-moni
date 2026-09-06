import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (p) => fs.readFileSync(path.join(root,p),'utf8')
const migration = read('supabase/migrations/20260831010000_steps_6_11_financial_hardening.sql')
const checks = [
  ['deposit review RPC', /create or replace function public\.admin_review_deposit/],
  ['deposit idempotent settlement', /already_reviewed/],
  ['deposit audit', /deposit\.credited/],
  ['withdrawal hold state', /on_hold/],
  ['withdrawal settlement exact-one ledger guard', /tx_count <> 1/],
  ['withdrawal failure exact-one ledger guard', /already released/],
  ['internal transfer unique idempotency index', /send_requests_user_idempotency_idx/],
  ['internal transfer deterministic lock order', /deterministic lock order/i],
  ['crypto submission idempotency', /already_submitted/],
  ['crypto provider reference audit', /withdrawal\.crypto_submitted/],
  ['service-role restriction', /grant execute on function public\.admin_settle_withdrawal.*service_role/s],
]
let failed = 0
for (const [name, re] of checks) {
  const ok = re.test(migration)
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed++
}
const ui = read('components/admin/deposit-actions.tsx')
const section = read('app/admin/[section]/page.tsx')
for (const [name, text, re] of [
  ['deposit review note UI', ui, /prompt\(action === 'approve'/],
  ['deposit evidence display', section, /screenshot_url/],
  ['withdrawal destination evidence', section, /provider_reference/],
]) {
  const ok = re.test(text); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed++
}
process.exitCode = failed ? 1 : 0

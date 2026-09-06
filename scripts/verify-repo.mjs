import fs from 'node:fs'
import path from 'node:path'
const root = process.cwd()
const required = [
  'app/page.tsx','app/profile/page.tsx','app/fund/page.tsx','app/withdraw/page.tsx',
  'app/send-money/page.tsx','app/transactions/page.tsx','app/finances/page.tsx',
  'services/walletService.ts','services/transaction.service.ts','services/deposit.ts','services/withdrawal.ts',
  'supabase/migrations/20260826_withdrawal_requests.sql','supabase/migrations/20260826_operational_service_requests.sql',
  'app/api/data/purchase/route.ts','app/api/transfers/send/route.ts','app/api/airtime/purchase/route.ts',
  'app/api/bills/pay/route.ts','app/api/scan/pay/route.ts'
]
const forbidden = [
  'Welcome back, Sarah!','customerName: "SARAH NICHOLAS"','98% success rate for simulation','97% success rate for simulation',
  'Transaction Successful!','Payment Successful!'
]
const failures=[]
for (const file of required) if (!fs.existsSync(path.join(root,file))) failures.push(`missing: ${file}`)
const scanFiles=['app/api/airtime/purchase/route.ts','app/api/bills/pay/route.ts','app/api/bills/validate/route.ts','app/api/scan/pay/route.ts','app/api/scan/decode/route.ts','app/pay-bills/page.tsx','app/buy-airtime/page.tsx','app/scan-pay/page.tsx']
for (const file of scanFiles) {
  const text=fs.readFileSync(path.join(root,file),'utf8')
  for (const token of forbidden) if (text.includes(token)) failures.push(`forbidden demo token in ${file}: ${token}`)
}
if (failures.length) { console.error(failures.join('\n')); process.exit(1) }
console.log(`Static verification passed: ${required.length} required files present; operational service routes contain no audited demo-success markers.`)

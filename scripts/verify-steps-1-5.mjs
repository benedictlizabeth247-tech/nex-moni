import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const failures = []
const required = [
  'ARCHITECTURE_CANONICAL.md',
  'supabase/MIGRATION_BASELINE.md',
  'supabase/migrations/20260831000000_steps_1_5_canonical_security_and_deposit.sql',
  'app/api/deposits/bank/route.ts',
  'lib/admin.ts',
  'app/admin/layout.tsx',
]
for (const file of required) if (!fs.existsSync(path.join(root, file))) failures.push(`missing ${file}`)

function walk(dir) {
  const out=[]
  for (const e of fs.readdirSync(dir,{withFileTypes:true})) {
    if (['node_modules','.next','.git'].includes(e.name)) continue
    const f=path.join(dir,e.name)
    if(e.isDirectory()) out.push(...walk(f)); else if(/\.(ts|tsx|js|mjs)$/.test(e.name)) out.push(f)
  }
  return out
}
const files=walk(root)
for(const f of files){
  const t=fs.readFileSync(f,'utf8')
  if(/from\s+['"]firebase\//.test(t)||/['"]@\/firebase/.test(t)) failures.push(`Firebase runtime import: ${path.relative(root,f)}`)
}
const providerUi=files.filter(f=>f.includes('app'+path.sep+'fund-account'+path.sep)).map(f=>fs.readFileSync(f,'utf8')).join('\n')
for(const token of ['Paystack','Stripe funding','/api/payments/paystack','/api/payments/stripe']) if(providerUi.includes(token)) failures.push(`provider funding remains in canonical deposit UI: ${token}`)
const adminOrder=fs.readFileSync(path.join(root,'app/api/admin/orders/route.ts'),'utf8')
if(!adminOrder.includes('createAdminClient()')) failures.push('admin order mutation does not use the server service-role boundary')
const admin=fs.readFileSync(path.join(root,'lib/admin.ts'),'utf8')
if(!admin.includes("from('admin_staff')") || !admin.includes("eq('active', true)")) failures.push('admin authorization is not registry-based')

if(failures.length){console.error('STEPS 1-5 CHECK: FAIL'); failures.forEach(x=>console.error('- '+x)); process.exit(1)}
console.log('STEPS 1-5 CHECK: PASS (source-level boundary verification)')

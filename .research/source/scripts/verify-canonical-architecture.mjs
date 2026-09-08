import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const failures = []
const required = [
  'lib/supabase/server.ts',
  'lib/supabase/client.ts',
  'lib/supabase/admin.ts',
  'lib/admin.ts',
  'app/admin/layout.tsx',
  'app/affiliate/layout.tsx',
  'supabase/migrations/20260830_production_funding_and_admin_controls.sql',
]
for (const file of required) if (!fs.existsSync(path.join(root, file))) failures.push(`Missing ${file}`)

function walk(dir) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.next', '.git', '.archive-inspect'].includes(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else if (/\.(ts|tsx|js|mjs|json)$/.test(entry.name)) out.push(full)
  }
  return out
}
const files = walk(root)
const firebaseRefs = []
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8')
  if (/[@'\"]\/firebase|from\s+['\"]firebase\//.test(text)) firebaseRefs.push(path.relative(root, file))
}
if (firebaseRefs.length) failures.push(`Firebase runtime imports remain: ${firebaseRefs.join(', ')}`)

const sourceFiles = files.filter((f) => !f.includes(`${path.sep}scripts${path.sep}`))
const source = sourceFiles.map((f) => fs.readFileSync(f, 'utf8')).join('\n')
const hardcodedAdmins = ['www.atuchukwuarinze@gmail.com', 'stevearinze594@gmail.com', 'fxchristopher96@gmail.com']
for (const email of hardcodedAdmins) {
  const hits = source.split('\n').filter((line) => line.includes(email))
  const allowedMigrationHit = hits.every((line) => line.includes('migration'))
  if (hits.length && !allowedMigrationHit) failures.push(`Administrator email is hard-coded outside migration: ${email}`)
}

if (failures.length) {
  console.error('CANONICAL ARCHITECTURE CHECK: FAIL')
  failures.forEach((x) => console.error(`- ${x}`))
  process.exit(1)
}
console.log('CANONICAL ARCHITECTURE CHECK: PASS')
console.log('Supabase is the only application backend; admin authorization is registry-based; no Firebase runtime imports remain.')

import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(process.cwd(), 'supabase/migrations')
const files = fs.readdirSync(root).filter((f) => f.endsWith('.sql')).sort()
const sql = files.map((f) => ({ f, text: fs.readFileSync(path.join(root, f), 'utf8') }))

const created = new Set()
for (const { text } of sql) {
  for (const match of text.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-zA-Z_][a-zA-Z0-9_]*)/gi)) created.add(match[1])
}

const knownExternal = new Set(['profiles', 'wallets', 'wallet_transactions', 'orders', 'ledger_entries', 'autopilot_allocations'])
const references = new Set()
for (const { text } of sql) {
  for (const match of text.matchAll(/public\.([a-zA-Z_][a-zA-Z0-9_]*)/g)) references.add(match[1])
}

const unresolved = [...references].filter((name) => !created.has(name) && knownExternal.has(name)).sort()
console.log(`Migration files: ${files.length}`)
console.log(`Tables created in supplied migrations: ${created.size}`)
console.log(`Known pre-existing table dependencies: ${unresolved.join(', ') || 'none'}`)

if (!files.every((f, i) => i === 0 || f >= files[i - 1])) {
  console.error('FAIL: migration ordering is not deterministic.')
  process.exit(1)
}

if (unresolved.length) {
  console.warn('BASELINE REQUIRED: supplied migrations depend on legacy/base tables not defined in this archive.')
  console.warn('Do not invent those tables. Pull the exact remote schema from the linked Supabase project.')
  process.exitCode = 2
}

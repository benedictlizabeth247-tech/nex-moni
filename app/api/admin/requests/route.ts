import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getAdminContext } from '@/lib/admin'
import { db } from '@/lib/db'
import { deposits as neonDeposits, withdrawals as neonWithdrawals, operationalRecords, transactions, user as neonUsers } from '@/lib/db/schema'
import { desc } from 'drizzle-orm'

const adminTables = [
  'profiles', 'wallets', 'wallet_transactions', 'deposits',
  'withdrawal_requests', 'trading_orders', 'trading_positions',
  'exchange_ledger', 'notifications', 'audit_logs', 'admin_staff',
] as const

export async function GET() {
  const context = await getAdminContext()
  if (!context) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
  const user = context.user

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!serviceKey || !supabaseUrl) return NextResponse.json({ error: 'Admin service role is not configured.' }, { status: 503 })

  const admin = createSupabaseClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const staff = context.staff

  const [neonUserRows, ...tableResults] = await Promise.all([
    db.select({ id: neonUsers.id, name: neonUsers.name, email: neonUsers.email, createdAt: neonUsers.createdAt, emailVerified: neonUsers.emailVerified }).from(neonUsers).orderBy(desc(neonUsers.createdAt)).limit(1000),
    db.select().from(neonDeposits).orderBy(desc(neonDeposits.createdAt)).limit(250),
    db.select().from(neonWithdrawals).orderBy(desc(neonWithdrawals.createdAt)).limit(250),
    db.select().from(operationalRecords).orderBy(desc(operationalRecords.createdAt)).limit(1000),
    db.select().from(transactions).orderBy(desc(transactions.createdAt)).limit(1000),
    ...adminTables.filter((table) => !['deposits', 'withdrawal_requests'].includes(table)).map((table) => admin.from(table).select('*').order('created_at', { ascending: false }).limit(250)),
  ])
  const users = neonUserRows.map((record) => ({
    id: record.id,
    name: record.name,
    email: record.email,
    created_at: record.createdAt?.toISOString() ?? null,
    email_confirmed_at: record.emailVerified ? record.createdAt?.toISOString() ?? null : null,
  }))

  const neonDepositRows = tableResults[0] || []
  const neonWithdrawalRows = tableResults[1] || []
  const neonOperationalRows = tableResults[2] || []
  const neonTransactionRows = tableResults[3] || []
  const supabaseResults = tableResults.slice(4)
  const records = Object.fromEntries(adminTables.map((table) => {
    if (table === 'deposits') return [table, neonDepositRows]
    if (table === 'withdrawal_requests') return [table, neonWithdrawalRows]
    const index = adminTables.filter((candidate) => !['deposits', 'withdrawal_requests'].includes(candidate)).indexOf(table)
    const result = supabaseResults[index]
    return [table, Array.isArray(result) ? result : result?.data || []]
  }))
  return NextResponse.json({
    user: { id: user.id, email: user.email },
    staff,
    users,
    profiles: records.profiles,
    wallets: records.wallets,
    walletTransactions: records.wallet_transactions,
    deposits: records.deposits,
    withdrawals: records.withdrawal_requests,
    operationalRecords: neonOperationalRows,
    transactions: neonTransactionRows,
    orders: records.trading_orders,
    positions: records.trading_positions,
    ledger: records.exchange_ledger,
    notifications: records.notifications,
    auditLogs: records.audit_logs,
  })
}

export const dynamic = 'force-dynamic'

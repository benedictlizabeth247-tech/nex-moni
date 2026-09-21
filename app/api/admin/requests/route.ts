import { NextResponse } from 'next/server'
import { getAdminContext } from '@/lib/admin'
import { db } from '@/lib/db'
import { deposits as neonDeposits, withdrawals as neonWithdrawals, operationalRecords, transactions, user as neonUsers } from '@/lib/db/schema'
import { desc } from 'drizzle-orm'

const adminTables = [] as const

export async function GET() {
  const context = await getAdminContext()
  if (!context) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
  const user = context.user

  const staff = context.staff

  const [neonUserRows, ...tableResults] = await Promise.all([
    db.select({ id: neonUsers.id, name: neonUsers.name, email: neonUsers.email, createdAt: neonUsers.createdAt, emailVerified: neonUsers.emailVerified }).from(neonUsers).orderBy(desc(neonUsers.createdAt)).limit(1000),
    db.select().from(neonDeposits).orderBy(desc(neonDeposits.createdAt)).limit(250),
    db.select().from(neonWithdrawals).orderBy(desc(neonWithdrawals.createdAt)).limit(250),
    db.select().from(operationalRecords).orderBy(desc(operationalRecords.createdAt)).limit(1000),
    db.select().from(transactions).orderBy(desc(transactions.createdAt)).limit(1000),

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
  const records = { profiles: [], wallets: [], wallet_transactions: [], deposits: neonDepositRows, withdrawal_requests: neonWithdrawalRows, trading_orders: [], trading_positions: [], exchange_ledger: [], notifications: [], audit_logs: [] }
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

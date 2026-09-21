import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getAdminContext } from '@/lib/admin'
import { db } from '@/lib/db'
import { deposits as neonDeposits } from '@/lib/db/schema'
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

  const [{ data: authUsers, error: usersError }, ...tableResults] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    db.select().from(neonDeposits).orderBy(desc(neonDeposits.createdAt)).limit(250),
    ...adminTables.filter((table) => table !== 'deposits').map((table) => admin.from(table).select('*').order('created_at', { ascending: false }).limit(250)),
  ])
  if (usersError) return NextResponse.json({ error: 'Unable to load registered users.' }, { status: 502 })

  const neonDepositRows = tableResults[0] || []
  const supabaseResults = tableResults.slice(1)
  const records = Object.fromEntries(adminTables.map((table) => {
    if (table === 'deposits') return [table, neonDepositRows]
    const index = adminTables.filter((candidate) => candidate !== 'deposits').indexOf(table)
    const result = supabaseResults[index]
    return [table, Array.isArray(result) ? result : result?.data || []]
  }))
  const users = (authUsers?.users || []).map(({ id, email, phone, created_at, last_sign_in_at, email_confirmed_at, user_metadata }) => ({
    id, email, phone, created_at, last_sign_in_at, email_confirmed_at,
    name: user_metadata?.full_name || user_metadata?.name || null,
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
    orders: records.trading_orders,
    positions: records.trading_positions,
    ledger: records.exchange_ledger,
    notifications: records.notifications,
    auditLogs: records.audit_logs,
  })
}

export const dynamic = 'force-dynamic'

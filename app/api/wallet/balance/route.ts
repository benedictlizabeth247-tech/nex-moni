import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { ledgerEntries, transactions, wallets } from '@/lib/db/schema'
import { and, desc, eq, inArray } from 'drizzle-orm'

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const wallet = await db.select().from(wallets).where(and(eq(wallets.userId, session.user.id), eq(wallets.currency, 'USDT'))).limit(1)
  const current = wallet[0]
  const entries = current ? await db.select({ direction: ledgerEntries.direction, amount: ledgerEntries.amount }).from(ledgerEntries).where(and(eq(ledgerEntries.userId, session.user.id), eq(ledgerEntries.currency, 'USDT'))) : []
  const calculatedBalance = entries.reduce((total, entry) => total + (entry.direction === 'CREDIT' ? Number(entry.amount) : -Number(entry.amount)), 0)
  const storedBalance = Number(current?.availableBalance ?? 0)
  const recentTransactions = await db.select().from(transactions).where(and(eq(transactions.userId, session.user.id), inArray(transactions.status, ['completed', 'pending']))).orderBy(desc(transactions.createdAt)).limit(20)

  return NextResponse.json({ stored_balance: storedBalance, calculated_balance: calculatedBalance, discrepancy_detected: Math.abs(storedBalance - calculatedBalance) > 0.00000001, wallet_id: current?.id ?? null, last_updated: current?.updatedAt ?? null, transactions: recentTransactions })
}

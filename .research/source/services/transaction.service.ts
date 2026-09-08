'use client'

import { getTransactions } from '@/services/walletService'
import type { WalletTransaction } from '@/types/database'
import type { Transaction } from '@/types'

/**
 * Transaction ledger adapter.
 * The UI consumes the application's canonical wallet_transactions ledger;
 * this service intentionally contains no demo/fallback transactions.
 */
export const TransactionService = {
  async getRecentTransactions(_userId: string, limit = 10): Promise<Transaction[]> {
    const rows = await getTransactions(limit)
    return rows.map(toTransaction)
  },
}

function toTransaction(row: WalletTransaction): Transaction {
  const type: Transaction['type'] =
    row.amount >= 0
      ? row.type === 'transfer' ? 'transfer' : 'income'
      : row.type === 'withdrawal' ? 'expense' : 'expense'

  return {
    id: row.id,
    userId: row.user_id,
    walletId: row.wallet_id,
    title: row.title,
    amount: Math.abs(Number(row.amount ?? 0)),
    type,
    category: row.category,
    timestamp: row.created_at,
    status: row.status === 'completed' ? 'completed' : row.status,
    referenceId: row.reference_id,
    recipient: row.recipient ?? undefined,
  }
}

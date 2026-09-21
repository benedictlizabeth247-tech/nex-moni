import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { db } from "@/lib/db"
import { wallets, transactions } from "@/lib/db/schema"
import { and, desc, eq, inArray } from "drizzle-orm"

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const [wallet] = await db.select().from(wallets).where(and(eq(wallets.userId, user.id), eq(wallets.currency, "USDT"))).limit(1)
    const rows = wallet
      ? await db.select().from(transactions).where(and(eq(transactions.userId, user.id), eq(transactions.walletId, wallet.id), eq(transactions.currency, "USDT"), inArray(transactions.status, ["completed", "COMPLETED"]))).orderBy(desc(transactions.createdAt)).limit(100)
      : []

    const calculated = rows.reduce((total, transaction) => {
      const amount = Number(transaction.amount)
      return total + (transaction.type === "withdrawal" || transaction.type === "transfer_out" ? -amount : amount)
    }, 0)
    const stored = Number(wallet?.availableBalance ?? 0)

    return NextResponse.json({
      balance_usdt: stored,
      currency: "USDT",
      stored_balance: stored,
      calculated_balance: calculated,
      discrepancy_detected: Math.abs(stored - calculated) > 0.00000001,
      wallet_id: wallet?.id ?? null,
      last_updated: wallet?.updatedAt ?? null,
      transactions: rows,
    }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("[v0] Wallet balance request failed", error)
    return NextResponse.json({ error: "Unable to load wallet balance." }, { status: 500 })
  }
}

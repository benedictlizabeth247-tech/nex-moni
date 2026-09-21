import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { db } from "@/lib/db"
import { wallets, transactions } from "@/lib/db/schema"
import { and, desc, eq, inArray } from "drizzle-orm"

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    const user = session?.user
    if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const [wallet] = await db.select().from(wallets).where(and(eq(wallets.userId, user.id), eq(wallets.currency, "USDT"))).limit(1)
    const [fallbackWallet] = wallet ? [null] : await db.select().from(wallets).where(eq(wallets.userId, user.id)).orderBy(desc(wallets.updatedAt)).limit(1)
    const activeWallet = wallet ?? fallbackWallet
    const walletCurrency = activeWallet?.currency ?? "USDT"
    const rows = activeWallet
      ? await db.select().from(transactions).where(and(eq(transactions.userId, user.id), eq(transactions.walletId, activeWallet.id), eq(transactions.currency, walletCurrency), inArray(transactions.status, ["completed", "COMPLETED"]))).orderBy(desc(transactions.createdAt)).limit(100)
      : []

    const calculated = rows.reduce((total, transaction) => {
      const amount = Number(transaction.amount)
      return total + (transaction.type === "withdrawal" || transaction.type === "transfer_out" ? -amount : amount)
    }, 0)
    const stored = Number(activeWallet?.availableBalance ?? 0)

    return NextResponse.json({
      success: true,
      balance_usdt: stored,
      currency: walletCurrency,
      stored_balance: stored,
      calculated_balance: calculated,
      discrepancy_detected: Math.abs(stored - calculated) > 0.00000001,
      wallet_id: activeWallet?.id ?? null,
      last_updated: activeWallet?.updatedAt ?? null,
      transactions: rows,
    }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("[v0] Wallet balance request failed", error)
    return NextResponse.json({ error: "Unable to load wallet balance." }, { status: 500 })
  }
}

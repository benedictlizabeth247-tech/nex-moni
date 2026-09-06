import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdmin } from "@/lib/admin"
import { z } from "zod"

const schema = z.object({
  userId: z.string().uuid(),
  amount: z.number().finite().positive("Amount must be greater than zero"),
  currency: z.enum(["NGN", "USD", "USDT"]).default("USDT"),
  reference: z.string().trim().max(120).optional(),
  reason: z.string().trim().min(3).max(500),
})

export async function POST(request: Request) {
  let adminContext: Awaited<ReturnType<typeof requireAdmin>>
  try {
    adminContext = await requireAdmin()
  } catch {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 })
  }
  const user = adminContext.user
  const admin = createAdminClient()
  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse({
    userId: body?.userId,
    amount: Number(body?.amount),
    currency: body?.currency || "USDT",
    reason: body?.reason,
    reference: body?.reference,
  })
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid amount, currency and reason." }, { status: 400 })

  try {
    const { data, error } = await admin.rpc("admin_fund_wallet", {
      p_actor_user_id: user.id,
      p_user_id: parsed.data.userId,
      p_amount: parsed.data.amount,
      p_currency: parsed.data.currency,
      p_reason: parsed.data.reason,
      p_reference: parsed.data.reference ?? null,
    })
    if (error) return NextResponse.json({ error: error.message, code: error.code ?? "RPC_FAILED", details: error.details ?? null }, { status: 422 })
    return NextResponse.json({ wallet: data, committed: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Wallet funding failed." }, { status: 422 })
  }
}

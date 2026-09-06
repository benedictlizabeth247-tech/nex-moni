import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { z } from "zod"

const schema = z.object({
  userId: z.string().uuid(),
  amount: z.number().finite().refine(value => value !== 0, "Amount cannot be zero"),
  currency: z.enum(["NGN", "USD"]).default("NGN"),
  reason: z.string().trim().min(3).max(500),
})

export async function POST(request: Request) {
  const auth = await createServerClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user?.id) return NextResponse.json({ error: "Admin access required." }, { status: 403 })

  const admin = createAdminClient()
  const { data: staff, error: staffError } = await admin
    .from("admin_staff")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle()
  if (staffError || !staff) return NextResponse.json({ error: "Admin access required." }, { status: 403 })

  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse({
    userId: body?.userId,
    amount: Number(body?.amount),
    currency: body?.currency || "NGN",
    reason: body?.reason,
  })
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid amount, currency and reason." }, { status: 400 })

  try {
    const { data, error } = await admin.rpc("admin_fund_wallet", {
      p_actor_user_id: user.id,
      p_user_id: parsed.data.userId,
      p_amount: parsed.data.amount,
      p_currency: parsed.data.currency,
      p_reason: parsed.data.reason,
      p_reference: null,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 422 })
    return NextResponse.json({ wallet: data })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Wallet funding failed." }, { status: 422 })
  }
}

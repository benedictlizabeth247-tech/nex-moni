import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin'

const schema = z.object({ userId: z.string().uuid(), currency: z.string().trim().min(3).max(10), action: z.enum(['freeze','unfreeze','restrict_withdrawals','allow_withdrawals','restrict_trading','allow_trading','reconcile']), reason: z.string().trim().max(500).optional().nullable() })
export async function POST(request: Request) {
  const context = await requireAdmin()
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid wallet control request.' }, { status: 400 })
  const admin = createAdminClient()
  if (parsed.data.action === 'reconcile') {
    const { data, error } = await admin.rpc('admin_reconcile_wallet', { p_actor_user_id: context.user.id, p_user_id: parsed.data.userId, p_currency: parsed.data.currency })
    if (error) return NextResponse.json({ error: error.message }, { status: 422 })
    return NextResponse.json(data)
  }
  const { data, error } = await admin.rpc('admin_set_wallet_controls', { p_actor_user_id: context.user.id, p_user_id: parsed.data.userId, p_currency: parsed.data.currency, p_action: parsed.data.action, p_reason: parsed.data.reason || null })
  if (error) return NextResponse.json({ error: error.message }, { status: 422 })
  return NextResponse.json(data)
}

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const schema = z.object({
  withdrawalId: z.string().uuid(),
  action: z.enum(['approve','reject','hold','mark_processing','resume','complete','fail']),
  note: z.string().trim().max(500).optional().nullable(),
})

export async function POST(request: Request) {
  const auth = await createServerClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user?.id) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })

  const admin = createAdminClient()
  const { data: staff, error: staffError } = await admin.from('admin_staff').select('user_id').eq('user_id', user.id).eq('active', true).maybeSingle()
  if (staffError || !staff) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid withdrawal operation.' }, { status: 400 })

  const rpc = parsed.data.action === 'complete'
    ? admin.rpc('admin_settle_withdrawal', {
        p_actor_user_id: user.id,
        p_withdrawal_id: parsed.data.withdrawalId,
        p_note: parsed.data.note || null,
      })
    : parsed.data.action === 'fail'
      ? admin.rpc('admin_fail_withdrawal', {
          p_actor_user_id: user.id,
          p_withdrawal_id: parsed.data.withdrawalId,
          p_reason: parsed.data.note || '',
        })
      : admin.rpc('admin_manage_withdrawal', {
          p_actor_user_id: user.id,
          p_withdrawal_id: parsed.data.withdrawalId,
          p_action: parsed.data.action,
          p_note: parsed.data.note || null,
        })
  const { data, error } = await rpc
  if (error) return NextResponse.json({ error: error.message }, { status: 422 })
  return NextResponse.json(data)
}

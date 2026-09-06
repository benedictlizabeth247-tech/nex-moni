import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const schema = z.object({
  depositId: z.string().uuid(),
  action: z.enum(['approve', 'reject']),
  note: z.string().trim().max(500).optional(),
})

export async function POST(request: Request) {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user?.id) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })

  const admin = createAdminClient()
  const { data: staff } = await admin.from('admin_staff').select('user_id').eq('user_id', user.id).eq('active', true).maybeSingle()
  if (!staff) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid deposit action.' }, { status: 400 })

  const { data, error } = await admin.rpc('admin_review_deposit', {
    p_actor_user_id: user.id,
    p_deposit_id: parsed.data.depositId,
    p_action: parsed.data.action,
    p_note: parsed.data.note || null,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 422 })
  return NextResponse.json(data)
}

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin'

const schema = z.object({
  resource: z.enum(['airtime','data','bills','scan','merchant']),
  requestId: z.string().uuid(),
  action: z.enum(['process','fulfill','reject','approve']),
  note: z.string().trim().max(500).optional().nullable(),
})

export async function POST(request: Request) {
  const adminContext = await requireAdmin()
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid admin operation.' }, { status: 400 })
  const admin = createAdminClient()
  const { resource, requestId, action, note } = parsed.data
  const { data, error } = resource === 'merchant'
    ? await admin.rpc('admin_review_merchant_application', { p_actor_user_id: adminContext.user.id, p_application_id: requestId, p_action: action, p_note: note || null })
    : await admin.rpc('admin_fulfill_service_request', { p_actor_user_id: adminContext.user.id, p_resource: resource, p_request_id: requestId, p_action: action, p_note: note || null })
  if (error) return NextResponse.json({ error: error.message }, { status: 422 })
  return NextResponse.json(data)
}

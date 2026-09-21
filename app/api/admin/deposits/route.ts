import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin'
import { z } from 'zod'
import { db } from '@/lib/db'
import { deposits as neonDeposits } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

const schema = z.object({
  depositId: z.string().uuid(),
  action: z.enum(['approve', 'reject']),
  note: z.string().trim().max(500).optional(),
})

export async function POST(request: Request) {
  let adminContext: Awaited<ReturnType<typeof requireAdmin>>
  try {
    adminContext = await requireAdmin()
  } catch {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
  }
  const user = adminContext.user
  const admin = createAdminClient()
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid deposit action.' }, { status: 400 })

  const { data, error } = await admin.rpc('admin_review_deposit', {
    p_actor_user_id: user.id,
    p_deposit_id: parsed.data.depositId,
    p_action: parsed.data.action,
    p_note: parsed.data.note || null,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 422 })

  const result = Array.isArray(data) ? data[0] : data
  const status = parsed.data.action === 'approve' ? 'APPROVED' : 'REJECTED'
  await db.update(neonDeposits).set({
    status,
    reviewedAt: new Date(),
    reviewedBy: user.id,
    rejectionReason: parsed.data.action === 'reject' ? parsed.data.note ?? null : null,
    updatedAt: new Date(),
  }).where(eq(neonDeposits.id, parsed.data.depositId))
  return NextResponse.json(result)
}

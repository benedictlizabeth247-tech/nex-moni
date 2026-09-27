import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { sql } from '@/lib/neon-db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const context = await requireAdmin()
    const [users, auditLogs] = await Promise.all([
      sql`SELECT id, auth_user_id AS "authUserId", email, full_name AS "fullName", status, created_at AS "createdAt" FROM public.users ORDER BY created_at DESC LIMIT 250`,
      sql`SELECT id, actor_user_id AS "actorUserId", action, entity_type AS "entityType", entity_id AS "entityId", metadata, created_at AS "createdAt" FROM public.audit_logs ORDER BY created_at DESC LIMIT 250`,
    ])

    return NextResponse.json({
      user: context.user,
      staff: context.staff,
      users,
      auditLogs,
      orders: [],
      deposits: [],
      withdrawals: [],
      source: 'neon',
    })
  } catch {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
  }
}

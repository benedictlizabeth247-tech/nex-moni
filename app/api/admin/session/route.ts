import { NextResponse } from 'next/server'
import { getAdminContext } from '@/lib/admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const context = await getAdminContext()
    if (!context) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
    return NextResponse.json({ user: context.user, staff: context.staff })
  } catch {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
  }
}

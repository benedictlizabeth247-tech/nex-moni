import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ user: null }, { status: 401 })
  return NextResponse.json({ user: { id: session.user.id, email: session.user.email, name: session.user.name } })
}

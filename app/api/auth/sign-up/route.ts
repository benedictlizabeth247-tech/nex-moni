import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { upsertAppUser } from '@/lib/neon-db'

const schema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
  firstName: z.string().trim().min(1).max(80),
  surname: z.string().trim().min(1).max(80),
})

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Please check the details entered.' }, { status: 400 })

  const { email, password, firstName, surname } = parsed.data
  const name = `${firstName} ${surname}`.trim()
  const result = await auth.signUp.email({ email: email.toLowerCase(), password, name })

  if (result.error || !result.data?.user) {
    return NextResponse.json({ error: 'Unable to create your account. Please try again.' }, { status: 400 })
  }

  await upsertAppUser({
    authUserId: result.data.user.id,
    email: result.data.user.email,
    fullName: name,
  })

  return NextResponse.json({ userId: result.data.user.id, verified: true })
}

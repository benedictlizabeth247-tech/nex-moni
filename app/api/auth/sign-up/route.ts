import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { operationalRecords } from '@/lib/db/schema'

const schema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(6),
  firstName: z.string().trim().min(1).max(80),
  surname: z.string().trim().min(1).max(80),
})

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Please check the details entered.' }, { status: 400 })
  }

  const result = await auth.api.signUpEmail({
    body: {
      email: parsed.data.email.toLowerCase(),
      password: parsed.data.password,
      name: `${parsed.data.firstName} ${parsed.data.surname}`.trim(),
    },
  })

  if (!result?.user?.id) {
    return NextResponse.json({ error: 'Unable to create your account.', code: 'SIGNUP_FAILED' }, { status: 400 })
  }

  await db.insert(operationalRecords).values({ recordId: `USER-${result.user.id}`, userId: result.user.id, metadata: { source: 'signup', accountType: 'user', surname: parsed.data.surname.trim() } }).onConflictDoNothing()

  return NextResponse.json({ userId: result.user.id, verified: result.user.emailVerified })
}

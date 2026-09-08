import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

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

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.data.email.toLowerCase(),
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: {
      first_name: parsed.data.firstName,
      surname: parsed.data.surname,
      full_name: `${parsed.data.firstName} ${parsed.data.surname}`,
    },
  })

  if (error) {
    return NextResponse.json({ error: error.message, code: error.code ?? 'SIGNUP_FAILED' }, { status: 400 })
  }

  return NextResponse.json({ userId: data.user.id, verified: true })
}

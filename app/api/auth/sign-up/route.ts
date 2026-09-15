import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
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

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    return NextResponse.json({ error: 'Account service is not configured.', code: 'AUTH_CONFIG_MISSING' }, { status: 503 })
  }

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
    const code = error.code ?? 'SIGNUP_FAILED'
    const status = error.status ?? 400
    const message =
      code === 'user_already_exists' || code === 'email_exists'
        ? 'Email already registered.'
        : code === 'weak_password'
          ? 'Password does not meet the requirements.'
          : status === 429 || code === 'over_email_send_rate_limit'
            ? 'Too many signup attempts. Please try again later.'
            : 'Unable to create your account. Please try again.'
    return NextResponse.json({ error: message, code }, { status: status >= 400 && status < 500 ? status : 400 })
  }

  const { error: profileError } = await admin.from('profiles').upsert(
    {
      id: data.user.id,
      nex_user_id: data.user.id,
      full_name: `${parsed.data.firstName.trim()} ${parsed.data.surname.trim()}`,
      surname: parsed.data.surname.trim(),
      email: parsed.data.email.toLowerCase(),
      status: 'active',
      is_verified: true,
    },
    { onConflict: 'id' },
  )

  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id)
    return NextResponse.json({ error: 'Unable to create your profile.', code: 'PROFILE_CREATE_FAILED' }, { status: 500 })
  }

  return NextResponse.json({ userId: data.user.id, verified: true })
}

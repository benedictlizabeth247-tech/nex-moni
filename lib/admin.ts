import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type AdminContext = {
  user: {
    id: string
    email?: string | null
  }
  staff: {
    user_id: string
    email: string
    active: boolean
  }
}

/**
 * Canonical server-side administrator boundary.
 *
 * public.admin_staff is the sole runtime source of truth. The designated
 * administrator identities are provisioned by the Supabase migration chain;
 * application code never authorizes a user merely from a typed email address.
 */
async function provisionConfiguredAdmin(user: { id: string; email?: string | null }) {
  const configuredEmails = (process.env.ADMIN_STAFF_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)

  const email = user.email?.trim().toLowerCase()
  if (!email || !configuredEmails.includes(email)) return

  const admin = createAdminClient()
  const { error } = await admin.from('admin_staff').upsert(
    { user_id: user.id, email, active: true },
    { onConflict: 'user_id' },
  )
  if (error) throw error
}

export async function getAdminContext(): Promise<AdminContext | null> {
  const auth = await createClient()
  const {
    data: { user },
  } = await auth.auth.getUser()

  if (!user?.id) return null

  try {
    await provisionConfiguredAdmin(user)
    const admin = createAdminClient()
    const { data: staff, error } = await admin
      .from('admin_staff')
      .select('user_id,role,active')
      .eq('user_id', user.id)
      .eq('active', true)
      .maybeSingle()

    if (error || !staff) return null
    return {
      user,
      staff: {
        user_id: staff.user_id,
        email: user.email ?? '',
        active: staff.active,
      },
    }
  } catch {
    return null
  }
}

export async function requireAdmin(): Promise<AdminContext> {
  const context = await getAdminContext()
  if (!context) throw new Error('ADMIN_ACCESS_REQUIRED')
  return context
}

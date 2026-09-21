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
async function provisionConfiguredAdmins() {
  const configuredEmails = (process.env.ADMIN_STAFF_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
  if (!configuredEmails.length) return

  const admin = createAdminClient()
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const matchingUsers = data.users.filter((candidate) => candidate.email && configuredEmails.includes(candidate.email.toLowerCase()))
  if (!matchingUsers.length) return

  await admin.from('admin_staff').upsert(
    matchingUsers.map((candidate) => ({ user_id: candidate.id, email: candidate.email!.toLowerCase(), active: true })),
    { onConflict: 'user_id' },
  )
}

export async function getAdminContext(): Promise<AdminContext | null> {
  const auth = await createClient()
  const {
    data: { user },
  } = await auth.auth.getUser()

  if (!user?.id) return null

  try {
    await provisionConfiguredAdmins()
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

import 'server-only'

import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

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
function isConfiguredAdmin(email?: string | null) {
  const configuredEmails = (process.env.ADMIN_STAFF_EMAILS ?? '').split(',').map((value) => value.trim().toLowerCase()).filter(Boolean)
  return Boolean(email && configuredEmails.includes(email.trim().toLowerCase()))
}

export async function getAdminContext(): Promise<AdminContext | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  const user = session?.user
  if (!user?.id || !isConfiguredAdmin(user.email)) return null

  return {
    user: { id: user.id, email: user.email },
    staff: { user_id: user.id, email: user.email, active: true },
  }
}

export async function requireAdmin(): Promise<AdminContext> {
  const context = await getAdminContext()
  if (!context) throw new Error('ADMIN_ACCESS_REQUIRED')
  return context
}

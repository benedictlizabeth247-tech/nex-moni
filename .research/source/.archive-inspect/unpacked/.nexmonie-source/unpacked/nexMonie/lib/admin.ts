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
export async function getAdminContext(): Promise<AdminContext | null> {
  const auth = await createClient()
  const {
    data: { user },
  } = await auth.auth.getUser()

  if (!user?.id) return null

  try {
    const admin = createAdminClient()
    const { data: staff, error } = await admin
      .from('admin_staff')
      .select('user_id,email,active')
      .eq('user_id', user.id)
      .eq('active', true)
      .maybeSingle()

    if (error || !staff) return null
    return { user, staff }
  } catch {
    return null
  }
}

export async function requireAdmin(): Promise<AdminContext> {
  const context = await getAdminContext()
  if (!context) throw new Error('ADMIN_ACCESS_REQUIRED')
  return context
}

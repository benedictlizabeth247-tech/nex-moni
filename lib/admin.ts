import 'server-only'

import { getAuthSession } from '@/lib/auth'
import { getActiveAdmin, upsertAppUser } from '@/lib/neon-db'

export type AdminContext = {
  user: { id: string; email?: string | null; name?: string | null }
  staff: { id: string; userId: string; role: string; active: boolean }
}

export async function getAdminContext(): Promise<AdminContext | null> {
  const { data: session } = await getAuthSession()
  const user = session?.user
  if (!user?.id || !user.email) return null
  const appUser = await upsertAppUser({ authUserId: user.id, email: user.email, fullName: user.name })
  if (!appUser) return null
  const staff = await getActiveAdmin(user.id)
  if (!staff) return null
  return { user, staff }
}

export async function requireAdmin(): Promise<AdminContext> {
  const context = await getAdminContext()
  if (!context) throw new Error('ADMIN_ACCESS_REQUIRED')
  return context
}

'use server'

import { auth } from '@/lib/auth'

export async function signOutAction() {
  await auth.signOut()
  return { success: true }
}

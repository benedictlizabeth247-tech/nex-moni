import 'server-only'

import { neon } from '@neondatabase/serverless'

const databaseUrl = process.env.NEON_DATABASE_URL || process.env.NEON_POSTGRES_URL
if (!databaseUrl) throw new Error('NEON_DATABASE_URL is not configured')

export const sql = neon(databaseUrl)

export type AppUser = { id: string; authUserId: string; email: string; fullName: string | null; status: string }
export type AdminStaff = { id: string; userId: string; role: string; active: boolean }

export async function upsertAppUser(input: { authUserId: string; email: string; fullName?: string | null }) {
  const rows = await sql`
    INSERT INTO public.users (auth_user_id, email, full_name)
    VALUES (${input.authUserId}, ${input.email}, ${input.fullName ?? null})
    ON CONFLICT (auth_user_id) DO UPDATE SET email = EXCLUDED.email, full_name = COALESCE(EXCLUDED.full_name, public.users.full_name), updated_at = now()
    RETURNING id, auth_user_id AS "authUserId", email, full_name AS "fullName", status
  `
  return (rows[0] as AppUser | undefined) ?? null
}

export async function getAppUser(authUserId: string) {
  const rows = await sql`SELECT id, auth_user_id AS "authUserId", email, full_name AS "fullName", status FROM public.users WHERE auth_user_id = ${authUserId} LIMIT 1`
  return (rows[0] as AppUser | undefined) ?? null
}

export async function getActiveAdmin(authUserId: string) {
  const rows = await sql`SELECT s.id, s.user_id AS "userId", s.role, s.active FROM public.admin_staff s INNER JOIN public.users u ON u.id = s.user_id WHERE u.auth_user_id = ${authUserId} AND s.active = true AND u.status = 'active' LIMIT 1`
  return (rows[0] as AdminStaff | undefined) ?? null
}

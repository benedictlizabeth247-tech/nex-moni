import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  const url = 'https://mhklbqlsdwudysfpklzx.supabase.co'
  const key = process.env.JWT_2_2 || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.JWT_2
  if (!url || !key) throw new Error('Server Supabase service-role configuration is missing.')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

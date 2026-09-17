import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.JWT_2
  if (!url || !key) throw new Error('Server Supabase service-role configuration is missing.')
  if (new URL(url).hostname !== 'mhklbqlsdwudysfpklzx.supabase.co') throw new Error(`SUPABASE_CONFIGURATION_FAILURE: expected mhklbqlsdwudysfpklzx.supabase.co, received ${new URL(url).hostname}`)
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

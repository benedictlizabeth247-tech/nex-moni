import { createClient } from '@supabase/supabase-js'

const NEXMONIE_SUPABASE_URL = 'https://eqyoyrswqjqvsozttfxr.supabase.co'

export function createAdminClient() {
  const key =
    process.env.JWT_2_2 ??
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('Server Supabase secret configuration is missing.')
  return createClient(NEXMONIE_SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

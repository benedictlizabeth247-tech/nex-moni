import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = 'https://mhklbqlsdwudysfpklzx.supabase.co'
  const key = process.env.JWT_4 || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY

  if (!url || !key) {
    throw new Error('Supabase browser configuration is missing.')
  }
  return createBrowserClient(url, key, {
    // Secure cookies in production; not in dev, so localhost still works.
    cookieOptions: { secure: process.env.NODE_ENV === 'production' },
  })
}

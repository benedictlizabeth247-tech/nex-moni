import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY

  if (!url || !key) {
    throw new Error('Supabase browser configuration is missing.')
  }
  if (new URL(url).hostname !== 'mhklbqlsdwudysfpklzx.supabase.co') {
    console.error('[v0] SUPABASE_CONFIGURATION_FAILURE', { expected: 'mhklbqlsdwudysfpklzx.supabase.co', received: new URL(url).hostname })
  }

  return createBrowserClient(url, key, {
    // Secure cookies in production; not in dev, so localhost still works.
    cookieOptions: { secure: process.env.NODE_ENV === 'production' },
  })
}

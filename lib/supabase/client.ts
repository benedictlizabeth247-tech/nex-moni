import { createBrowserClient } from '@supabase/ssr'

const NEXMONIE_SUPABASE_URL = 'https://eqyoyrswqjqvsozttfxr.supabase.co'

export function createClient() {
  const publishableKey =
    process.env.JWT_3 ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  return createBrowserClient(
    NEXMONIE_SUPABASE_URL,
    publishableKey ?? 'placeholder-anon-key',
    {
      // Secure cookies in production; not in dev, so localhost still works.
      cookieOptions: { secure: process.env.NODE_ENV === 'production' },
    },
  )
}

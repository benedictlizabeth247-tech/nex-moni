import { createBrowserClient } from '@supabase/ssr'

const SUPABASE_URL = 'https://mhklbqlsdwudysfpklzx.supabase.co'

export function createClient() {
  // Next.js only exposes NEXT_PUBLIC_* values to browser bundles. The
  // next.config.mjs mapping supplies these from the saved project variables.
  // Keep the preview bootable while those variables are being injected.
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    'preview-key-not-configured'

  return createBrowserClient(SUPABASE_URL, supabaseKey, {
      // Secure cookies in production; not in dev, so localhost still works.
      cookieOptions: { secure: process.env.NODE_ENV === 'production' },
    },
  )
}

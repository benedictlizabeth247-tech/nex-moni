import { createBrowserClient } from '@supabase/ssr'

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  'https://mhklbqlsdwudysfpklzx.supabase.co'

export function createClient() {
  const configuredKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const supabaseKey =
    configuredKey ||
    (process.env.NEXT_PHASE === 'phase-production-build'
      ? 'build-only-placeholder-key'
      : undefined)

  if (!supabaseKey) {
    throw new Error(
      'Supabase publishable key is not available in the browser bundle. Check the Vercel environment variables and restart the preview.',
    )
  }

  return createBrowserClient(SUPABASE_URL, supabaseKey, {
    cookieOptions: { secure: process.env.NODE_ENV === 'production' },
  })
}

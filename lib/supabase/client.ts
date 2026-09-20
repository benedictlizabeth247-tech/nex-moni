import { createBrowserClient } from '@supabase/ssr'

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  'https://mhklbqlsdwudysfpklzx.supabase.co'

export function createClient() {
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    // Server-rendered pages can import the browser singleton during `next build`.
    // The real project key is injected in Vercel preview/production at runtime.
    (process.env.NEXT_PHASE === 'phase-production-build' ? 'build-placeholder-key' : undefined)

  if (!supabaseKey) {
    throw new Error('Supabase publishable key is not configured.')
  }

  return createBrowserClient(SUPABASE_URL, supabaseKey, {
      // Secure cookies in production; not in dev, so localhost still works.
      cookieOptions: { secure: process.env.NODE_ENV === 'production' },
    },
  )
}

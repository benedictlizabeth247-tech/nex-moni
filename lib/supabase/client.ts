import { createBrowserClient } from '@supabase/ssr'

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  'https://mhklbqlsdwudysfpklzx.supabase.co'

export function createClient() {
  const configuredKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY
  // Supabase is optional for the Better Auth-powered preview. Keep module
  // evaluation safe when the public key has not been injected yet; auth is
  // handled by Better Auth and Supabase-backed features can report their own
  // request errors instead of taking down the entire app.
  const supabaseKey = configuredKey || 'preview-supabase-key-unconfigured'

  return createBrowserClient(SUPABASE_URL, supabaseKey, {
    cookieOptions: { secure: process.env.NODE_ENV === 'production' },
  })
}

import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://mhklbqlsdwudysfpklzx.supabase.co'
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oa2xicWxzZHd1ZHlzZnBrbHp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzODM0NDIsImV4cCI6MjEwMzk1OTQ0Mn0.rUmSUqsD0eB_B486uQFmQlR7gKhdezf-o0Pk4Qr1koI'

  return createBrowserClient(url, key, {
    cookieOptions: {
      secure: process.env.NODE_ENV === 'production',
      // SameSite=None cookies are rejected by browsers unless Secure is also set.
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    },
  })
}

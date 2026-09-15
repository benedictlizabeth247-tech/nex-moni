import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = 'https://mhklbqlsdwudysfpklzx.supabase.co'
  const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oa2xicWxzZHd1ZHlzZnBrbHp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzODM0NDIsImV4cCI6MjEwMzk1OTQ0Mn0.rUmSUqsD0eB_B486uQFmQlR7gKhdezf-o0Pk4Qr1koI'

  return createBrowserClient(url ?? 'https://mhklbqlsdwudysfpklzx.supabase.co', key ?? 'sb_publishable_missing_configuration', {
    cookieOptions: {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
    },
  })
}

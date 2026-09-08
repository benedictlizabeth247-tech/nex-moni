
// Delegates to the SSR cookie-based browser client (lib/supabase/client.ts)
// so the session set on sign-in/sign-up is visible to middleware.ts and
// server components, which read the session from cookies, not localStorage.
// Using a separate raw @supabase/supabase-js client here previously stored
// the session in localStorage only, invisible server-side, causing
// authenticated users to be redirected back to /auth/login.
import { createClient as createBrowserSupabaseClient } from '@/lib/supabase/client';

export const supabase = createBrowserSupabaseClient();

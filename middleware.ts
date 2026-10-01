import { updateSession } from '@/lib/supabase/proxy'
import type { NextRequest } from 'next/server'

export default async function middleware(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)', '/(api|trpc)(.*)'],
}

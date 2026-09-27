import 'server-only'

import { createNeonAuth } from '@neondatabase/auth/next/server'

const isBuild = process.env.NEXT_PHASE === 'phase-production-build'
const baseUrl = process.env.NEON_AUTH_BASE_URL || process.env.NEON_VITE_NEON_AUTH_URL || (isBuild ? 'https://build.invalid' : '')
const configuredCookieSecret = process.env.NEON_AUTH_COOKIE_SECRET || ''
const cookieSecret = isBuild && configuredCookieSecret.length < 32
  ? 'build-only-placeholder-secret-please-configure'
  : configuredCookieSecret

if (!baseUrl) throw new Error('NEON_AUTH_BASE_URL is not configured')
if (!cookieSecret || cookieSecret.length < 32) throw new Error('NEON_AUTH_COOKIE_SECRET must be at least 32 characters')

export const auth = createNeonAuth({
  baseUrl,
  cookies: { secret: cookieSecret, sessionDataTtl: 300 },
})

export async function getAuthSession() {
  return auth.getSession()
}

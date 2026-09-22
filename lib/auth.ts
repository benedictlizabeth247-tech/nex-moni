import { createNeonAuth } from '@neondatabase/auth/next/server'

export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL || 'https://invalid-neon-auth.local',
  cookies: {
    secret: process.env.NEON_AUTH_COOKIE_SECRET || 'build-only-neon-auth-cookie-secret-32-chars',
  },
})

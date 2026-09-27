'use client'

import { createAuthClient } from '@neondatabase/auth'

const configuredBaseUrl = process.env.NEXT_PUBLIC_NEON_AUTH_BASE_URL || process.env.NEON_AUTH_BASE_URL || process.env.NEON_VITE_NEON_AUTH_URL
const baseUrl = configuredBaseUrl || (typeof window !== 'undefined' ? `${window.location.origin}/api/auth` : 'http://localhost:3000/api/auth')

export const authClient = createAuthClient(baseUrl)

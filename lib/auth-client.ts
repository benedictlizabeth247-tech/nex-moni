'use client'

import { createAuthClient } from '@neondatabase/auth'

const baseUrl = process.env.NEXT_PUBLIC_NEON_AUTH_BASE_URL || process.env.NEON_AUTH_BASE_URL || process.env.NEON_VITE_NEON_AUTH_URL
if (!baseUrl) throw new Error('Neon Auth base URL is not configured')

export const authClient = createAuthClient(baseUrl)

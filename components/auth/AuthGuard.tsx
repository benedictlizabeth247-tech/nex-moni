"use client"

import React, { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useUser } from '@/supabase'
import { Loader2 } from 'lucide-react'
import { NexLogo } from '@/components/ui/NexLogo'

const PUBLIC_PREFIXES = ['/auth', '/admin-login', '/finances']

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser()
  const router = useRouter()
  const pathname = usePathname()
  const isPublicPath = PUBLIC_PREFIXES.some((prefix) => pathname?.startsWith(prefix))

  // Server-rendered routes remain the authorization boundary; this guard keeps
  // the client view in sync while Better Auth restores the session cookie.
  useEffect(() => {
    if (!loading && !user && !isPublicPath) {
      const destination = pathname?.startsWith('/admin') ? '/admin-login' : '/auth/login'
      router.replace(`${destination}?redirectedFrom=${encodeURIComponent(pathname || '/')}`)
    }
  }, [loading, user, isPublicPath, pathname, router])

  if (isPublicPath) {
    return <>{children}</>
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAF9]">
        <div className="flex flex-col items-center">
          <NexLogo className="mb-6 animate-pulse" />
          <div className="flex items-center gap-3 bg-white px-5 py-2.5 rounded-full border border-gray-100 shadow-sm">
            <Loader2 size={16} className="animate-spin text-primary" />
            <span className="text-[13px] font-bold text-gray-400 uppercase tracking-widest">
              Authenticating...
            </span>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

"use client"

import React, { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useUser } from '@/supabase'
import { Loader2 } from 'lucide-react'
import { NexLogo } from '@/components/ui/NexLogo'

const PUBLIC_PREFIXES = ['/auth', '/finances']

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser()
  const router = useRouter()
  const pathname = usePathname()
  const isPublicPath = PUBLIC_PREFIXES.some((prefix) => pathname?.startsWith(prefix))

  // Server-side middleware (lib/supabase/proxy.ts) is the real enforcement
  // boundary. This is a client-side fallback so an already-loaded page
  // doesn't keep rendering protected content if the session drops.
  useEffect(() => {
    if (!loading && !user && !isPublicPath) {
      router.replace(`/auth/login?redirectedFrom=${encodeURIComponent(pathname || '/')}`)
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

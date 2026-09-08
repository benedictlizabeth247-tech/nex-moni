"use client"

import React, { useState, useEffect } from 'react'
import { X, RefreshCw, ChevronLeft, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * @fileOverview nexMonie Mini App Engine
 * Provides a reusable container for embed-friendly 3rd party services.
 * For services that block embedding (e.g. Spotify), UtilitiesHub triggers a system browser launch.
 */

interface MiniAppProps {
  name: string
  icon: React.ReactNode
  url: string
  onClose: () => void
}

export function MiniAppEngine({ name, icon, url, onClose }: MiniAppProps) {
  const [status, setStatus] = useState<'loading' | 'success'>('loading')

  useEffect(() => {
    // Initial loading transition
    const timer = setTimeout(() => {
      setStatus('success')
    }, 1500)

    return () => clearTimeout(timer)
  }, [url])

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col animate-in slide-in-from-bottom duration-500 fill-mode-forwards">
      {/* Mini App Header */}
      <header className="h-16 px-4 bg-white border-b border-gray-100 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center text-gray-400 active:bg-gray-50 transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center bg-gray-50/50 border border-gray-100 scale-90">
              {icon}
            </div>
            <span className="font-bold text-[#1A1A1A] text-[15px] tracking-tight">{name}</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button 
            onClick={() => { setStatus('loading'); setTimeout(() => setStatus('success'), 1000); }}
            className="w-10 h-10 rounded-full flex items-center justify-center text-gray-400 active:bg-gray-50 transition-colors"
          >
            <RefreshCw size={18} className={cn(status === 'loading' && "animate-spin text-primary")} />
          </button>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center text-gray-400 active:bg-gray-50 transition-colors"
          >
            <X size={22} />
          </button>
        </div>
      </header>

      {/* Mini App Content Area */}
      <main className="flex-1 relative overflow-hidden bg-[#F8FAF9]">
        {/* Loading Overlay */}
        {status === 'loading' && (
          <div className="absolute inset-0 z-50 bg-white flex flex-col items-center justify-center text-center p-8 transition-all">
             <div className="w-24 h-24 rounded-[32px] bg-gray-50 flex items-center justify-center mb-8 shadow-sm border border-gray-100 animate-pulse">
                <div className="scale-[1.8] opacity-80">{icon}</div>
             </div>
             <Loader2 className="animate-spin text-primary mb-5" size={32} />
             <h3 className="text-[18px] font-bold text-[#1A1A1A] mb-1.5">Opening {name}</h3>
             <p className="text-[13px] text-gray-400 font-medium tracking-tight uppercase tracking-[0.1em]">Preparing secure session...</p>
          </div>
        )}

        {/* Content Container (Iframe for Web, bridges to native WebView in Capacitor) */}
        <div className="w-full h-full">
           <iframe 
             src={url} 
             className="w-full h-full border-none"
             title={name}
             onLoad={() => setStatus('success')}
           />
        </div>
      </main>
    </div>
  )
}

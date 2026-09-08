"use client"

import React from 'react'
import { Home, Compass, Wallet, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRouter, usePathname } from 'next/navigation'

export function BottomNav() {
  const router = useRouter()
  const pathname = usePathname()

  const NavItem = ({ id, path, icon, label }: { id: string, path: string, icon: React.ReactNode, label: string }) => {
    const isActive = path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(`${path}/`)
    
    return (
      <button 
        onClick={() => router.push(path)}
        className={cn(
          "flex flex-col items-center justify-center gap-0.5 sm:gap-1 transition-all duration-300 flex-1 group min-w-0 py-1",
          isActive ? "text-primary" : "text-gray-400 hover:text-primary/70"
        )}
      >
        <div className="w-[22px] h-[22px] sm:w-[24px] sm:h-[24px] flex items-center justify-center transition-transform group-active:scale-90">
          {React.cloneElement(icon as React.ReactElement<Record<string, unknown>>, { 
            className: "w-full h-full",
            strokeWidth: isActive ? 2.5 : 2
          })}
        </div>
        <span className={cn(
          "text-[9px] sm:text-[11px] tracking-tight transition-colors truncate w-full px-1 text-center",
          isActive ? "font-bold" : "font-medium"
        )}>
          {label}
        </span>
      </button>
    )
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-1 sm:px-2 pt-2 pb-3 sm:py-3 z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] safe-area-bottom">
      <div className="w-full flex items-center justify-between relative px-1 sm:px-2">
        <NavItem id="home" path="/" icon={<Home />} label="Home" />
        <NavItem id="discovery" path="/earn" icon={<Compass />} label="Discovery" />
        
        <NavItem id="finances" path="/finances" icon={<Wallet />} label="Finance" />
        <NavItem id="profile" path="/profile" icon={<User />} label="Profile" />
      </div>
    </div>
  )
}

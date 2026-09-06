"use client"

import React, { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { BottomNav } from '@/components/layout/BottomNav'
import { Card } from '@/components/ui/card'
import { 
  Bell, 
  ChevronLeft, 
  ChevronRight, 
  Music, 
  UtensilsCrossed, 
  ShoppingBag, 
  Briefcase, 
  Users,
  Wallet,
  Gift
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { MiniAppEngine } from '@/components/mini-app/MiniAppEngine'

export default function UtilitiesHub() {
  const router = useRouter()
  const [touchStartX, setTouchStartX] = useState<number | null>(null)
  const [offsetX, setOffsetX] = useState(0)
  const isDragging = useRef(false)

  // Mini App State
  const [activeApp, setActiveApp] = useState<{ name: string, icon: React.ReactNode, url: string } | null>(null)

  const handleTouchStart = (e: React.TouchEvent) => {
    if (activeApp) return // Disable swipe when Mini App is open
    setTouchStartX(e.targetTouches[0].clientX)
    isDragging.current = true
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX === null || !isDragging.current) return
    const currentX = e.targetTouches[0].clientX
    const diff = currentX - touchStartX
    
    if (diff < 0) {
      setOffsetX(diff)
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return
    const touchEndX = e.changedTouches[0].clientX
    const distance = touchStartX - touchEndX

    isDragging.current = false

    if (distance > 150) {
      setOffsetX(-window.innerWidth)
      setTimeout(() => {
        router.push('/')
      }, 250)
    } else {
      setOffsetX(0)
    }
    setTouchStartX(null)
  }

  const openMiniApp = (name: string, icon: React.ReactNode, url: string) => {
    // Analysis: These major platforms explicitly block iframe/WebView embedding via X-Frame-Options or CSP.
    // To provide a smooth experience, we launch them in the system browser (which triggers the native app).
    const restrictedServices = [
      "Spotify", "Apple Music", "Audiomack", "Boomplay", 
      "X (Twitter)", "Telegram", "Chowdeck", "Bolt", 
      "inDrive", "Rida", "Jumia", "Konga", "Amazon", 
      "AliExpress", "Uber", "Booking.com", "Canva", 
      "Zoom", "Gmail", "Microsoft 365"
    ];

    if (restrictedServices.includes(name)) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      setActiveApp({ name, icon, url });
    }
  }

  return (
    <main 
      className={cn(
        "min-h-screen pb-32 bg-[#F8FAF9] will-change-transform overflow-x-hidden",
        !isDragging.current && "transition-transform duration-500 cubic-bezier(0.23, 1, 0.32, 1)"
      )}
      style={{ transform: `translateX(${offsetX}px)` }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <header className="px-4 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => router.push('/')}
            className="flex items-center gap-1 text-[14px] font-medium text-[#005F56] active:opacity-60"
          >
            <ChevronLeft size={20} />
            Back Home
          </button>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Bell size={24} className="text-[#1A1A1A]" />
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-accent rounded-full border-2 border-background flex items-center justify-center">
                <span className="sr-only">Notifications</span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-full border-[1.5px] border-gray-300 flex items-center justify-center overflow-hidden">
              <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400">
                <Users size={20} />
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="px-4 mb-6">
        <h1 className="text-[28px] font-bold text-[#1A1A1A] leading-tight mb-1">Utilities Hub</h1>
        <p className="text-[14px] text-gray-500 font-medium">All your everyday services in one place.</p>
      </div>

      <section className="px-4 mb-4">
        <Card className="p-4 border-none shadow-soft rounded-[16px] bg-white">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-bold text-[#1A1A1A]">Music</h3>
            <button className="text-[14px] font-bold text-primary">View all</button>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex gap-4">
              <BrandItem 
                label="Spotify"
                onClick={() => openMiniApp("Spotify", (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="12" fill="#1DB954"/>
                    <path d="M17.5 8C14.5 6.2 9.5 6 6.5 6.9C6 7.1 5.5 6.8 5.3 6.3C5.1 5.8 5.4 5.3 5.9 5.1C9.4 4.1 14.9 4.3 18.5 6.4C19 6.7 19.1 7.3 18.8 7.8C18.5 8.2 17.9 8.3 17.5 8Z" fill="white"/>
                    <path d="M16 11.2C13.5 9.7 9.5 9.2 7 10C6.6 10.1 6.2 9.9 6.1 9.5C6 9.1 6.2 8.7 6.6 8.6C9.5 7.7 14 8.2 16.9 10C17.3 10.2 17.4 10.7 17.2 11.1C17 11.5 16.4 11.4 16 11.2Z" fill="white"/>
                    <path d="M14.8 14.2C12.8 13 9.8 12.6 7.8 13.2C7.5 13.3 7.1 13.1 7 12.8C6.9 12.5 7.1 12.1 7.4 12C9.8 11.3 13.1 11.7 15.4 13.1C15.7 13.3 15.8 13.7 15.6 14C15.4 14.3 15.1 14.4 14.8 14.2Z" fill="white"/>
                  </svg>
                ), "https://open.spotify.com")}
              >
                <div className="w-12 h-12 rounded-full bg-[#191414] flex items-center justify-center">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="12" fill="#1DB954"/>
                    <path d="M17.5 8C14.5 6.2 9.5 6 6.5 6.9C6 7.1 5.5 6.8 5.3 6.3C5.1 5.8 5.4 5.3 5.9 5.1C9.4 4.1 14.9 4.3 18.5 6.4C19 6.7 19.1 7.3 18.8 7.8C18.5 8.2 17.9 8.3 17.5 8Z" fill="white"/>
                    <path d="M16 11.2C13.5 9.7 9.5 9.2 7 10C6.6 10.1 6.2 9.9 6.1 9.5C6 9.1 6.2 8.7 6.6 8.6C9.5 7.7 14 8.2 16.9 10C17.3 10.2 17.4 10.7 17.2 11.1C17 11.5 16.4 11.4 16 11.2Z" fill="white"/>
                    <path d="M14.8 14.2C12.8 13 9.8 12.6 7.8 13.2C7.5 13.3 7.1 13.1 7 12.8C6.9 12.5 7.1 12.1 7.4 12C9.8 11.3 13.1 11.7 15.4 13.1C15.7 13.3 15.8 13.7 15.6 14C15.4 14.3 15.1 14.4 14.8 14.2Z" fill="white"/>
                  </svg>
                </div>
              </BrandItem>
              <BrandItem 
                label="Apple Music"
                onClick={() => openMiniApp("Apple Music", (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FF4D80] to-[#FF2E5D] flex items-center justify-center">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                      <path d="M12 21c-4.418 0-8-3.582-8-8s3.582-8 8-8 8 3.582 8 8-3.582 8-8 8zm4-11.5h-2.5v4.5c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2c.4 0 .8.1 1 .3V8h3.5v1.5z" />
                    </svg>
                  </div>
                ), "https://music.apple.com")}
              >
                <div className="w-12 h-12 rounded-[12px] bg-white border border-gray-100 flex items-center justify-center overflow-hidden">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FF4D80] to-[#FF2E5D] flex items-center justify-center">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                      <path d="M12 21c-4.418 0-8-3.582-8-8s3.582-8 8-8 8 3.582 8 8-3.582 8-8 8zm4-11.5h-2.5v4.5c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2c.4 0 .8.1 1 .3V8h3.5v1.5z" />
                    </svg>
                  </div>
                </div>
              </BrandItem>
              <BrandItem 
                label="Audiomack"
                onClick={() => openMiniApp("Audiomack", (
                  <div className="flex items-end gap-[2px]">
                    <div className="w-[3px] h-[10px] bg-[#FF6600] rounded-full" />
                    <div className="w-[3px] h-[16px] bg-[#FF6600] rounded-full" />
                    <div className="w-[3px] h-[22px] bg-[#FF6600] rounded-full" />
                    <div className="w-[3px] h-[16px] bg-[#FF6600] rounded-full" />
                    <div className="w-[3px] h-[10px] bg-[#FF6600] rounded-full" />
                  </div>
                ), "https://audiomack.com")}
              >
                <div className="w-12 h-12 rounded-[12px] bg-black flex items-center justify-center">
                  <div className="flex items-end gap-[2px]">
                    <div className="w-[3px] h-[10px] bg-[#FF6600] rounded-full" />
                    <div className="w-[3px] h-[16px] bg-[#FF6600] rounded-full" />
                    <div className="w-[3px] h-[22px] bg-[#FF6600] rounded-full" />
                    <div className="w-[3px] h-[16px] bg-[#FF6600] rounded-full" />
                    <div className="w-[3px] h-[10px] bg-[#FF6600] rounded-full" />
                  </div>
                </div>
              </BrandItem>
              <BrandItem 
                label="Boomplay"
                onClick={() => openMiniApp("Boomplay", (
                   <span className="text-[#00BFA5] font-black text-2xl italic tracking-tighter">B</span>
                ), "https://www.boomplay.com")}
              >
                <div className="w-12 h-12 rounded-full bg-black flex items-center justify-center">
                  <span className="text-[#00BFA5] font-black text-2xl italic tracking-tighter">B</span>
                </div>
              </BrandItem>
            </div>
            <ChevronRight size={20} className="text-accent" />
          </div>
        </Card>
      </section>

      <section className="px-4 mb-4">
        <Card className="p-4 border-none shadow-soft rounded-[16px] bg-white">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-bold text-[#1A1A1A]">Social</h3>
            <button className="text-[14px] font-bold text-primary">View all</button>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex gap-4">
              <BrandItem 
                label="X (Twitter)"
                onClick={() => openMiniApp("X (Twitter)", (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                ), "https://twitter.com")}
              >
                <div className="w-12 h-12 rounded-[12px] bg-black flex items-center justify-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </div>
              </BrandItem>
              <BrandItem 
                label="Telegram"
                onClick={() => openMiniApp("Telegram", (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="white" className="mr-0.5">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.14-.257.257-.527.257l.215-3.048 5.548-5.013c.242-.214-.053-.332-.375-.118L6.416 13.06l-2.957-.924c-.642-.201-.654-.642.133-.948l11.564-4.456c.535-.194 1.003.126.738 1.489z" />
                  </svg>
                ), "https://web.telegram.org")}
              >
                <div className="w-12 h-12 rounded-full bg-[#2AABEE] flex items-center justify-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="white" className="mr-0.5">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.14-.257.257-.527.257l.215-3.048 5.548-5.013c.242-.214-.053-.332-.375-.118L6.416 13.06l-2.957-.924c-.642-.201-.654-.642.133-.948l11.564-4.456c.535-.194 1.003.126.738 1.489z" />
                  </svg>
                </div>
              </BrandItem>
            </div>
            <ChevronRight size={20} className="text-accent" />
          </div>
        </Card>
      </section>

      <div className="px-4 grid grid-cols-2 gap-3 mb-4">
        <Card className="p-4 border-none shadow-soft rounded-[16px] bg-[#FFF4EE]">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-9 h-9 rounded-full bg-[#FF8C00] flex items-center justify-center">
              <UtensilsCrossed size={18} className="text-white" />
            </div>
            <div>
              <h3 className="text-[14px] font-bold text-[#1A1A1A] leading-tight">Food & Transport</h3>
              <p className="text-[10px] text-gray-500 leading-tight">Order food or book a ride</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-y-3 mt-4">
            <SmallBrand 
              onClick={() => openMiniApp("Chowdeck", <div className="text-[#4A2F1D] font-black text-lg">C</div>, "https://chowdeck.com")}
              logo={<div className="w-9 h-9 rounded-full bg-[#FFD700] flex items-center justify-center text-[#4A2F1D] font-black text-lg">C</div>} 
              label="Chowdeck" 
            />
            <SmallBrand 
              onClick={() => openMiniApp("Bolt", <span className="text-[#34D186] font-bold text-[9px]">Bolt</span>, "https://bolt.eu")}
              logo={<div className="w-9 h-9 rounded-md bg-white flex items-center justify-center text-[#34D186] font-bold text-[9px] tracking-tighter">Bolt</div>} 
              label="Bolt" 
            />
            <SmallBrand 
              onClick={() => openMiniApp("inDrive", <span className="text-[#00C853] font-black text-[12px]">iD</span>, "https://www.indrive.com")}
              logo={<div className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-[#00C853] font-black text-[12px] border border-gray-100 shadow-sm">iD</div>} 
              label="inDrive" 
            />
            <SmallBrand 
              onClick={() => openMiniApp("Rida", <span className="text-white font-bold text-lg">R</span>, "https://rida.app")}
              logo={<div className="w-9 h-9 rounded-md bg-[#6C3CE1] flex items-center justify-center text-white font-bold text-lg">R</div>} 
              label="Rida" 
            />
          </div>
        </Card>

        <Card className="p-4 border-none shadow-soft rounded-[16px] bg-[#FFF0F0]">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-9 h-9 rounded-full bg-[#FF6B6B] flex items-center justify-center">
              <ShoppingBag size={18} className="text-white" />
            </div>
            <div>
              <h3 className="text-[14px] font-bold text-[#1A1A1A] leading-tight">Shop</h3>
              <p className="text-[10px] text-gray-500 leading-tight">Shop from top stores</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-y-3 mt-4">
             <div onClick={() => openMiniApp("Jumia", <span>★</span>, "https://jumia.com.ng")} className="w-8 h-8 rounded-full bg-[#FF6600] flex items-center justify-center text-white text-[10px] font-bold cursor-pointer transition-transform active:scale-90">★</div>
             <div onClick={() => openMiniApp("Konga", <span>☺</span>, "https://konga.com")} className="w-8 h-8 rounded-full bg-[#E91E8C] flex items-center justify-center text-white text-[10px] font-bold cursor-pointer transition-transform active:scale-90">☺</div>
             <div onClick={() => openMiniApp("Amazon", <span>a</span>, "https://amazon.com")} className="w-8 h-8 rounded-md bg-white flex flex-col items-center justify-center shadow-sm cursor-pointer transition-transform active:scale-90">
                <span className="text-black font-bold text-[10px] leading-none">a</span>
                <div className="w-5 h-[2px] bg-[#FF9900] rounded-full mt-[1px]" />
             </div>
             <div onClick={() => openMiniApp("AliExpress", <span>AE</span>, "https://aliexpress.com")} className="w-8 h-8 rounded-md bg-[#FF4747] flex items-center justify-center text-white text-[9px] font-black cursor-pointer transition-transform active:scale-90">AE</div>
             <div onClick={() => openMiniApp("Uber", <span>Uber</span>, "https://uber.com")} className="w-8 h-8 rounded-md bg-black flex items-center justify-center text-white text-[8px] font-bold tracking-tight cursor-pointer transition-transform active:scale-90">Uber</div>
          </div>
        </Card>
      </div>

      <div className="px-4 grid grid-cols-2 gap-3 mb-6">
        <Card className="p-4 border-none shadow-soft rounded-[16px] bg-[#E8F5F3]">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-9 h-9 rounded-full bg-[#005F56] flex items-center justify-center">
              <Briefcase size={18} className="text-white" />
            </div>
            <div>
              <h3 className="text-[14px] font-bold text-[#1A1A1A] leading-tight">Travel & Productivity</h3>
              <p className="text-[10px] text-gray-500 leading-tight">Travel work and more</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            <div onClick={() => openMiniApp("Booking.com", <span>B</span>, "https://booking.com")} className="w-8 h-8 rounded-md bg-[#003580] flex items-center justify-center text-white font-black text-xs cursor-pointer active:scale-90">B</div>
            <div onClick={() => openMiniApp("Canva", <span>C</span>, "https://canva.com")} className="w-8 h-8 rounded-full bg-[#00C4CC] flex items-center justify-center text-white font-black text-xs cursor-pointer active:scale-90">C</div>
            <div onClick={() => openMiniApp("Zoom", <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>, "https://zoom.us")} className="w-8 h-8 rounded-md bg-[#2D8CFF] flex items-center justify-center text-white cursor-pointer active:scale-90">
               <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>
            </div>
            <div onClick={() => openMiniApp("Gmail", <span>M</span>, "https://mail.google.com")} className="w-8 h-8 rounded-md bg-white shadow-sm flex items-center justify-center cursor-pointer active:scale-90">
               <svg width="16" height="16" viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" fill="#4285F4"/></svg>
            </div>
            <div onClick={() => openMiniApp("Microsoft 365", <span>MS</span>, "https://microsoft365.com")} className="w-8 h-8 rounded-md bg-white shadow-sm flex items-center justify-center p-1 cursor-pointer active:scale-90">
               <div className="grid grid-cols-2 gap-[1px] w-full h-full">
                  <div className="bg-[#F25022] rounded-[1px]" />
                  <div className="bg-[#7FBA00] rounded-[1px]" />
                  <div className="bg-[#00A4EF] rounded-[1px]" />
                  <div className="bg-[#FFB900] rounded-[1px]" />
               </div>
            </div>
          </div>
        </Card>

        <Card className="p-4 border-none shadow-soft rounded-[16px] bg-[#EEF4FF]">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-9 h-9 rounded-full bg-[#3B82F6] flex items-center justify-center">
              <Users size={18} className="text-white" />
            </div>
            <div>
              <h3 className="text-[14px] font-bold text-[#1A1A1A] leading-tight">Other Services</h3>
              <p className="text-[10px] text-gray-500 leading-tight">More services coming soon</p>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <Gift size={32} className="text-accent" />
            <div className="w-8 h-8 rounded-md bg-gray-200/50 flex items-center justify-center text-gray-400">···</div>
            <div className="w-8 h-8 rounded-md bg-gray-200/50 flex items-center justify-center text-gray-400">···</div>
          </div>
        </Card>
      </div>

      <div className="px-4 mb-8">
        <Card className="p-5 border-none bg-[#005F56] rounded-[24px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-[12px] bg-white/10 flex items-center justify-center">
              <Wallet size={22} className="text-white" />
            </div>
            <div>
              <h3 className="text-[16px] font-bold text-white">Pay seamlessly</h3>
              <p className="text-[12px] text-white/75">Pay with crypto. We handle the rest.</p>
            </div>
          </div>
          <button 
            onClick={() => router.push('/fund-account')}
            className="px-4 py-2 border-[1.5px] border-white rounded-full text-[13px] font-bold text-white bg-transparent active:bg-white/10 transition-colors"
          >
            Add Money →
          </button>
        </Card>
      </div>

      {/* Mini App Portal */}
      {activeApp && (
        <MiniAppEngine 
          name={activeApp.name} 
          icon={activeApp.icon} 
          url={activeApp.url} 
          onClose={() => setActiveApp(null)} 
        />
      )}

      <BottomNav />
    </main>
  )
}

function BrandItem({ children, label, onClick }: { children: React.ReactNode, label: string, onClick?: () => void }) {
  return (
    <div 
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 w-[64px] active:scale-95 transition-transform"
    >
      <div className="transition-transform active:scale-90 duration-200 cursor-pointer">
        {children}
      </div>
      <span className="text-[11px] text-gray-500 text-center leading-tight truncate w-full font-medium">{label}</span>
    </div>
  )
}

function SmallBrand({ logo, label, onClick }: { logo: React.ReactNode, label: string, onClick?: () => void }) {
  return (
    <div 
      onClick={onClick}
      className="flex flex-col items-center gap-1 active:scale-95 transition-transform"
    >
      <div className="transition-transform active:scale-90 duration-200 cursor-pointer">
        {logo}
      </div>
      <span className="text-[10px] text-gray-500 leading-none font-medium">{label}</span>
    </div>
  )
}

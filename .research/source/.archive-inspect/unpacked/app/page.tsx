'use client';

import { useEffect, useRef, useState } from 'react';
import type { TouchEvent } from 'react';
import { Bell, ChevronRight } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { NexLogo } from '@/components/ui/NexLogo';
import { CommandCenter } from '@/components/dashboard/CommandCenter';
import { QuickActionGrid } from '@/components/dashboard/QuickActionGrid';
import { ProductDiscovery } from '@/components/dashboard/ProductDiscovery';
import { NexTipsBanner } from '@/components/dashboard/NexTipsBanner';
import MarketsFeed from '@/components/MarketsFeed';
import { BottomNav } from '@/components/layout/BottomNav';
import { getWallet } from '@/services/walletService';
import { getProfile } from '@/services/profileService';
import type { Profile } from '@/types/database';
import type { Wallet as DbWallet } from '@/types/database';
import type { Wallet } from '@/types';

function toCommandCenterWallet(w: DbWallet | null): Wallet | null {
  if (!w) return null;
  return {
    id: w.id,
    userId: w.user_id,
    available: w.available,
    savings: w.savings,
    investments: w.investments,
    vault: w.vault,
    lastUpdated: w.updated_at,
    currency: w.currency,
  };
}

function HomeContent() {
  const router = useRouter();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [walletLoading, setWalletLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [greeting, setGreeting] = useState('Good evening');
  const [homePage, setHomePage] = useState<0 | 1>(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([getWallet(), getProfile()])
      .then(([w, p]) => {
        if (mounted) {
          setWallet(toCommandCenterWallet(w));
          setProfile(p);
        }
      })
      .finally(() => {
        if (mounted) setWalletLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const updateGreeting = () => {
      const hour = Number(new Intl.DateTimeFormat('en-NG', { hour: 'numeric', hour12: false, timeZone: 'Africa/Lagos' }).format(new Date()));
      if (hour >= 5 && hour < 12) setGreeting('Good morning');
      else if (hour >= 12 && hour < 17) setGreeting('Good afternoon');
      else setGreeting('Good evening');
    };
    updateGreeting();
    const id = window.setInterval(updateGreeting, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const username = profile?.display_name?.trim() || profile?.email?.split('@')[0] || 'there';

  const handleTouchStart = (event: TouchEvent) => {
    touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  };

  const handleTouchEnd = (event: TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const dx = event.changedTouches[0].clientX - start.x;
    const dy = event.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) < 70 || Math.abs(dx) <= Math.abs(dy) * 1.2) return;
    if (dx < 0 && homePage === 0) setHomePage(1);
    if (dx > 0 && homePage === 1) setHomePage(0);
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#F3EEEC] pb-24" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <header className="sticky top-0 z-30 border-b border-border bg-white/95 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[11px] font-black tracking-[-0.02em] text-foreground">nexMonie</span>
            <span className="mt-1 text-[15px] font-semibold text-muted-foreground">{greeting}, <span className="font-black text-foreground">{username}</span></span>
          </div>
        <div className="flex items-center gap-2">
        <button onClick={() => router.push('/profile')} className="relative h-9 w-9 overflow-hidden rounded-full border border-[#E1D5D1] bg-[#F8F2F0]" aria-label="Open profile">
          {profile?.photo_url ? <Image src={profile.photo_url} alt="" fill className="object-cover" unoptimized /> : <span className="flex h-full w-full items-center justify-center text-[10px] font-black text-[#7A5E58]">{username.slice(0,1).toUpperCase()}</span>}
          <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#FFFDFB] bg-[#3B82F6]" aria-hidden="true" />
        </button>
        <Link
          href="/notifications"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-accent"
          aria-label="Notifications"
        >
          <Bell className="h-[18px] w-[18px]" />
        </Link>
        </div>
        </div>
      </header>

      <main className="px-4 pt-4">
        <div className="overflow-hidden">
          <div className="flex w-[200%] transition-transform duration-300 ease-out" style={{ transform: `translateX(-${homePage * 50}%)` }}>
            <section className="w-1/2 shrink-0 pr-2">
              <CommandCenter wallet={wallet} loading={walletLoading} />
              <QuickActionGrid />
              <ProductDiscovery />
              <NexTipsBanner />
              <MarketsFeed />
            </section>
            <section className="w-1/2 shrink-0 pl-2">
              <div className="mb-5 rounded-[26px] border border-[#E1D5D1] bg-[#FFFDFB] p-5 shadow-[0_14px_40px_rgba(80,55,50,.06)]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[.18em] text-[#9A7772]">Home services</p>
                    <h2 className="mt-1 text-[20px] font-black tracking-tight text-[#342A28]">Everyday money tools</h2>
                  </div>
                  <button onClick={() => setHomePage(0)} className="flex h-10 w-10 items-center justify-center rounded-full border border-[#E5D9D6] bg-[#F8F2F0]" aria-label="Back to home"><ChevronRight className="rotate-180" size={18}/></button>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  {[['Airtime','/buy-airtime'],['Data','/buy-data'],['Bills','/pay-bills'],['Scan & Pay','/scan-pay'],['Request Money','/request-money'],['P2P','/finance/p2p']].map(([label,path]) => (
                    <button key={path} onClick={() => router.push(path)} className="flex min-h-[82px] items-end rounded-[20px] border border-[#E8DEDA] bg-[#F8F2F0] p-4 text-left transition-transform active:scale-[.98]">
                      <span className="text-[12px] font-black text-[#4A3936]">{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </div>
        <div className="mb-3 flex items-center justify-center gap-1.5" aria-label="Home pages">
          {[0,1].map((page) => <button key={page} onClick={() => setHomePage(page as 0 | 1)} className={`h-1.5 rounded-full transition-all ${homePage === page ? 'w-6 bg-[#D86F68]' : 'w-1.5 bg-[#C9B8B4]'}`} aria-label={`Show home page ${page + 1}`} />)}
        </div>
        <p className="mb-4 text-center text-[8px] font-bold uppercase tracking-[.18em] text-[#9A7772]">Swipe left for services</p>
      </main>

      <BottomNav />
    </div>
  );
}

export default function HomePage() {
  return (
    <AuthGuard>
      <HomeContent />
    </AuthGuard>
  );
}

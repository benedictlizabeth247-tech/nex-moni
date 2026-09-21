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
import { getTradingAccountSummary } from '@/services/internalTradingService';
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
  const [balanceUsdt, setBalanceUsdt] = useState(0);
  const [equity, setEquity] = useState<number | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [homePage, setHomePage] = useState<0 | 1>(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let mounted = true;
  const balanceRequest = fetch('/api/wallet/balance', { cache: 'no-store' }).then((response) => response.ok ? response.json() : Promise.reject(new Error('Balance unavailable')))
  Promise.allSettled([getProfile(), getTradingAccountSummary(), balanceRequest])
  .then(([profileResult, equityResult, balanceResult]) => {
        if (!mounted) return;
  if (balanceResult.status === 'fulfilled') {
    const syncedBalance = Number(balanceResult.value.balance_usdt ?? 0);
    setBalanceUsdt(syncedBalance);
    setWallet((current) => current ? { ...current, available: syncedBalance, currency: 'USDT' } : {
      id: String(balanceResult.value.wallet_id ?? 'neon-wallet'),
      userId: '',
      available: syncedBalance,
      savings: 0,
      investments: 0,
      vault: 0,
      lastUpdated: balanceResult.value.last_updated ?? new Date().toISOString(),
      currency: balanceResult.value.currency ?? 'USDT',
    });
  }
  if (profileResult.status === 'fulfilled') setProfile(profileResult.value);
        if (equityResult.status === 'fulfilled') setEquity(Number(equityResult.value?.equity ?? 0));
      })
      .finally(() => {
        if (mounted) {
          setWalletLoading(false);
          setProfileLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  const registeredName = profile?.full_name?.trim() || [profile?.surname?.trim()].filter(Boolean).join(' ');
  const hour = new Date().getHours();
  const greeting = hour >= 5 && hour < 12 ? 'Good morning' : hour >= 12 && hour < 17 ? 'Good afternoon' : hour >= 17 && hour < 21 ? 'Good evening' : 'Good night';
  const identityLabel = profileLoading ? 'Loading profile…' : registeredName || 'Member';


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
    <div className="min-h-screen overflow-x-hidden bg-[#0b1714] pb-24" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <header className="sticky top-0 z-30 border-b border-[#29463b] bg-[#0b1714]/95 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex flex-col items-center gap-1">
            <NexLogo />
            <div className="flex flex-col">
              <span className="text-[15px] font-semibold text-muted-foreground">
                {profileLoading ? 'Loading profile…' : `${greeting}, ${identityLabel}`}
              </span>
            </div>
          </div>
        <div className="flex items-center gap-2">
        <button onClick={() => router.push('/profile')} className="relative h-9 w-9 overflow-hidden rounded-full border border-[#E1D5D1] bg-[#F8F2F0]" aria-label="Open profile">
          {profile?.photo_url ? <Image src={profile.photo_url} alt="" fill className="object-cover" unoptimized /> : <span className="flex h-full w-full items-center justify-center text-[10px] font-black text-[#7A5E58]">{(registeredName || 'M').slice(0, 1).toUpperCase()}</span>}
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
              <CommandCenter wallet={wallet} equity={equity} loading={walletLoading} />
              <QuickActionGrid />
              <ProductDiscovery />
              <NexTipsBanner />
              <MarketsFeed />
            </section>
            <section className="w-1/2 shrink-0 pl-2">
              <div className="mb-5 rounded-[26px] border border-[#29463b] bg-[#11221d] p-5 shadow-[0_18px_50px_rgba(0,0,0,.22)]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[.18em] text-[#8eafa0]">Home services</p>
                    <h2 className="mt-1 text-[20px] font-black tracking-tight text-[#f4f7f1]">Everyday money tools</h2>
                  </div>
                  <button onClick={() => setHomePage(0)} className="flex h-10 w-10 items-center justify-center rounded-full border border-[#29463b] bg-[#19312a]" aria-label="Back to home"><ChevronRight className="rotate-180" size={18}/></button>
                </div>
                <div className="mt-5 grid grid-cols-3 gap-2.5">
                  {[
                    ['Transfer', '/send-money', '↗'],
                    ['Deposit', '/fund-account', '↓'],
                    ['Withdraw', '/withdraw', '↑'],
                    ['P2P', '/finance/p2p', '⇄'],
                    ['Spot', '/markets', '◇'],
                    ['Futures', '/futures', '◈'],
                    ['Finance', '/finances', '▣'],
                    ['Profile', '/profile', '◎'],
                    ['More', '/actions-hub', '⋯'],
                  ].map(([label, path, icon]) => (
                    <button key={path} onClick={() => router.push(path)} className="flex min-h-[76px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-2xl border border-[#29463b] bg-[#13251f] px-1.5 py-2.5 text-center transition-colors hover:bg-secondary active:scale-[.98]">
                      <span aria-hidden="true" className="text-[18px] font-semibold leading-none text-[#a7f36c]">{icon}</span>
                      <span className="truncate text-[11px] font-black text-[#e8f4df]">{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </div>
        <div className="mb-3 flex items-center justify-center gap-1.5" aria-label="Home pages">
          {[0,1].map((page) => <button key={page} onClick={() => setHomePage(page as 0 | 1)} className={`h-1.5 rounded-full transition-all ${homePage === page ? 'w-6 bg-[#a7f36c]' : 'w-1.5 bg-[#29463b]'}`} aria-label={`Show home page ${page + 1}`} />)}
        </div>
        <p className="mb-4 text-center text-[8px] font-bold uppercase tracking-[.18em] text-[#8eafa0]">Swipe left for services</p>
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

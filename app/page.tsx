'use client';

import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
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


  return (
    <div className="min-h-screen overflow-x-hidden bg-background pb-24">
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
        <section className="min-w-0">
          <CommandCenter wallet={wallet} equity={equity} loading={walletLoading} />
          <QuickActionGrid />
          <ProductDiscovery />
          <NexTipsBanner />
          <MarketsFeed />
        </section>
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

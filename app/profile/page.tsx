"use client"

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDownToLine, ArrowLeft, ArrowLeftRight, ArrowUpFromLine, Bell, ChevronRight, Copy, Eye, EyeOff, Globe, History, Languages, Lock, LogOut, Search, Settings, ShieldCheck, SlidersHorizontal, User, WalletCards, X, Sun, Moon } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { useUser } from '@/supabase'
import { NexLogo } from '@/components/ui/NexLogo'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { getProfile } from '@/services/profileService'
import { getWallet, getTransactions, type Wallet as WalletType, type WalletTransaction } from '@/services/walletService'
import { getTradingAccount, type TradingAccount } from '@/services/internalTradingService'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types/database'

const money = (n:number) => `${Number(n||0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })} USDT`

type AssetTab = 'overview' | 'spot' | 'futures' | 'funding'

export default function ProfileScreen() {
  const router = useRouter()
  const { user } = useUser()
  const { toast } = useToast()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [wallet, setWallet] = useState<WalletType | null>(null)
  const [account, setAccount] = useState<TradingAccount | null>(null)
  const [transactions, setTransactions] = useState<WalletTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [showBalance, setShowBalance] = useState(true)
  const [tab, setTab] = useState<AssetTab>('overview')
  const [notifications, setNotifications] = useState(true)
  const [biometrics, setBiometrics] = useState(true)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [theme, setTheme] = useState<'light'|'dark'>('light')

  const load = async () => {
    if (!user) return
    setLoading(true)
    try {
      const [p,w,a,t] = await Promise.all([getProfile(), getWallet(), getTradingAccount(), getTransactions(8)])
      setProfile(p); setWallet(w); setAccount(a); setTransactions(t)
    } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [user])

  useEffect(() => {
    const saved = window.localStorage.getItem('nexMonie-theme') as 'light'|'dark'|null
    const next = saved === 'dark' ? 'dark' : 'light'
    setTheme(next)
    document.documentElement.classList.toggle('dark', next === 'dark')
    document.documentElement.classList.toggle('light', next === 'light')
  }, [])

  const changeTheme = (next: 'light'|'dark') => {
    setTheme(next)
    window.localStorage.setItem('nexMonie-theme', next)
    document.documentElement.classList.toggle('dark', next === 'dark')
    document.documentElement.classList.toggle('light', next === 'light')
  }

  const balances = useMemo(() => ({
    funding: Number(account?.funding_balance ?? wallet?.available ?? 0),
    spot: Number(account?.spot_balance ?? 0),
    futures: Number(account?.futures_balance ?? 0),
  }), [account, wallet])
  const total = balances.funding + balances.spot + balances.futures
  const displayed = tab === 'spot' ? balances.spot : tab === 'futures' ? balances.futures : tab === 'funding' ? balances.funding : total

  const copy = async (text:string) => { await navigator.clipboard?.writeText(text); toast({title:'Copied',description:'Account identifier copied to clipboard.'}) }

  const signOut = async () => {
    const supabase = createClient()
    const { error } = await supabase.auth.signOut()
    if (error) { toast({variant:'destructive', title:'Sign out failed', description:error.message}); return }
    router.replace('/auth/login')
  }

  return (
    <main className="min-h-screen bg-[#EEF2F1] pb-36 text-[#183A36] overflow-x-hidden">
      <header className="sticky top-0 z-40 border-b border-[#D6E1DE] bg-[#EEF2F1]/95 px-4 pt-7 pb-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <button onClick={() => router.back()} className="h-10 w-10 rounded-xl bg-white border border-[#D6E1DE] flex items-center justify-center"><ArrowLeft size={18}/></button>
          <NexLogo />
          <div className="flex items-center gap-1">
            <button onClick={() => router.push('/notifications')} className="h-10 w-10 rounded-xl bg-white border border-[#D6E1DE] flex items-center justify-center"><Bell size={18}/></button>
            <button onClick={() => setShowSearch(v=>!v)} className="h-10 w-10 rounded-xl bg-white border border-[#D6E1DE] flex items-center justify-center"><Search size={18}/></button>
          </div>
        </div>
        {showSearch && <div className="mt-3 flex items-center gap-2 rounded-xl border border-[#D6E1DE] bg-white px-3 h-11"><Search size={15} className="text-[#708A85]"/><input autoFocus placeholder="Search assets, settings or activity" className="w-full bg-transparent text-[11px] outline-none"/><button onClick={()=>setShowSearch(false)}><X size={15}/></button></div>}
        <div className="mt-4 flex items-end justify-between">
          <div><p className="text-[9px] font-bold uppercase tracking-[.18em] text-[#708A85]">Profile & Assets</p><h1 className="mt-1 text-[22px] font-black">{profile?.display_name || 'Profile'}</h1></div>
          <Badge className="bg-[#E8F7F0] text-[#087F5B] border-none text-[9px] font-black">{profile?.is_verified ? 'Verified' : 'Verification pending'}</Badge>
        </div>
      </header>

      <div className="space-y-4 px-4 py-4">
        <Card className="rounded-[28px] border-[#D6E1DE] bg-white p-5 shadow-none">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-[#E8F7F0] flex items-center justify-center text-[#087F5B] overflow-hidden">
              {profile?.photo_url ? <img src={profile.photo_url} alt="Profile" className="h-full w-full object-cover"/> : <User size={22}/>} 
            </div>
            <div className="min-w-0 flex-1"><p className="text-[15px] font-black truncate">{profile?.display_name || 'nexMonie Member'}</p><p className="text-[10px] text-[#708A85] truncate">{profile?.email || user?.email || 'Member account'}</p></div>
            <button onClick={()=>document.getElementById('profile-preferences')?.scrollIntoView({behavior:'smooth'})} className="h-9 w-9 rounded-xl bg-[#F5F8F7] flex items-center justify-center"><Settings size={16}/></button>
          </div>
          <div className="mt-4 rounded-2xl bg-[#183A36] p-4 text-white">
            <div className="flex items-center justify-between"><p className="text-[9px] uppercase tracking-[.18em] text-white/60">Total estimated balance</p><button onClick={()=>setShowBalance(v=>!v)}>{showBalance?<Eye size={16}/>:<EyeOff size={16}/>}</button></div>
            <p className="mt-2 text-[29px] font-black tracking-tight">{loading ? '••••••' : showBalance ? money(total) : '••••••••'}</p>
            <p className="mt-1 text-[9px] text-white/55">Funding + Spot + Futures account balances</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={()=>router.push('/fund-account')} className="flex items-center justify-center gap-1.5 rounded-xl bg-[#16A36A] py-2.5 text-[10px] font-black"><ArrowDownToLine size={14}/> Deposit / Fund</button>
              <button onClick={()=>router.push('/withdraw')} className="flex items-center justify-center gap-1.5 rounded-xl bg-white/10 py-2.5 text-[10px] font-black border border-white/15"><ArrowUpFromLine size={14}/> Withdraw</button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button onClick={()=>router.push('/send-money')} className="flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/10 py-2.5 text-[10px] font-black"><ArrowUpFromLine size={14}/> Send</button>
              <button onClick={()=>router.push('/wallet-details')} className="flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/10 py-2.5 text-[10px] font-black"><ArrowDownToLine size={14}/> Receive</button>
            </div>
          </div>
        </Card>

        <Card className="rounded-[26px] border-[#D6E1DE] bg-white p-2 shadow-none">
          <div className="flex gap-1 overflow-x-auto">
            {(['overview','spot','futures','funding'] as AssetTab[]).map(t=><button key={t} onClick={()=>setTab(t)} className={cn('min-w-[82px] flex-1 rounded-xl py-2.5 text-[10px] font-black capitalize',tab===t?'bg-[#E8F7F0] text-[#087F5B]':'text-[#708A85]')}>{t}</button>)}
          </div>
        </Card>

        <section className="grid grid-cols-3 gap-2">
          {[['Funding',balances.funding,'funding'],['Spot',balances.spot,'spot'],['Futures',balances.futures,'futures']].map(([label,value,key])=><button key={String(key)} onClick={()=>setTab(key as AssetTab)} className={cn('rounded-2xl border p-3 text-left bg-white',tab===key?'border-[#087F5B]':'border-[#D6E1DE]')}><p className="text-[9px] text-[#708A85]">{label}</p><p className="mt-1 text-[13px] font-black truncate">{showBalance?money(Number(value)):'••••'}</p></button>)}
        </section>

        <Card className="rounded-[26px] border-[#D6E1DE] bg-white p-4 shadow-none">
          <div className="flex items-center justify-between"><div><p className="text-[9px] uppercase tracking-[.16em] text-[#708A85]">{tab === 'overview' ? 'Overview' : `${tab} balance`}</p><p className="mt-1 text-[24px] font-black">{showBalance?money(displayed):'••••••'}</p></div><button onClick={()=>router.push('/assets')} className="rounded-xl bg-[#E8F7F0] px-3 py-2 text-[9px] font-black text-[#087F5B]">Full assets</button></div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button onClick={()=>router.push('/assets')} className="rounded-xl border border-[#D6E1DE] py-2.5 text-[9px] font-black flex items-center justify-center gap-1"><ArrowDownToLine size={13}/> Transfer</button>
            <button onClick={()=>router.push('/transactions')} className="rounded-xl border border-[#D6E1DE] py-2.5 text-[9px] font-black flex items-center justify-center gap-1"><History size={13}/> History</button>
          </div>
        </Card>

        <Card className="rounded-[26px] border-[#D6E1DE] bg-white p-4 shadow-none">
          <div className="flex items-center justify-between"><div><p className="text-[11px] font-black">Recent account activity</p><p className="text-[9px] text-[#708A85]">Deposits, transfers, payments and wallet events</p></div><button onClick={()=>router.push('/transactions')}><ChevronRight size={17} className="text-[#708A85]"/></button></div>
          <div className="mt-3 space-y-2">{transactions.slice(0,5).map(tx=><div key={tx.id} className="flex items-center justify-between rounded-xl bg-[#F5F8F7] p-3"><div><p className="text-[10px] font-bold">{tx.title}</p><p className="text-[8px] text-[#708A85]">{new Date(tx.created_at).toLocaleString()}</p></div><span className={cn('text-[10px] font-black',tx.amount>=0?'text-[#16A36A]':'text-[#B94A48]')}>{tx.amount>=0?'+':''}{money(tx.amount)}</span></div>)}{!transactions.length&&<p className="rounded-xl bg-[#F5F8F7] p-4 text-[9px] text-[#708A85]">No account activity yet.</p>}</div>
        </Card>

        <section className="space-y-2">
          <label className="ml-1 text-[9px] font-black uppercase tracking-[.16em] text-[#708A85]">Account</label>
          <Card className="overflow-hidden rounded-[26px] border-[#D6E1DE] bg-white shadow-none divide-y divide-[#EEF2F1]">
            <ProfileOption icon={<WalletCards/>} title="Assets & transfers" subtitle="Funding, Spot, Futures and internal transfers" onClick={()=>router.push('/assets')} />
            <ProfileOption icon={<ArrowDownToLine/>} title="Deposit / Fund" subtitle="Bank and crypto funding" onClick={()=>router.push('/fund-account')} />
            <ProfileOption icon={<ArrowUpFromLine/>} title="Withdraw" subtitle="Move available funds out of nexMonie" onClick={()=>router.push('/withdraw')} />
            <ProfileOption icon={<ShieldCheck/>} title="KYC & verification" subtitle={profile?.is_verified?'Verified account':'Complete verification'} />
            <ProfileOption icon={<Copy/>} title="Wallet details" subtitle="nexMonie ID and wallet identity" onClick={()=>router.push('/wallet-details')} />
          </Card>
        </section>

        <section id="profile-preferences" className="space-y-2 scroll-mt-24">
          <label className="ml-1 text-[9px] font-black uppercase tracking-[.16em] text-[#708A85]">Preferences & security</label>
          <Card className="overflow-hidden rounded-[26px] border-[#D6E1DE] bg-white shadow-none divide-y divide-[#EEF2F1]">
            <ProfileOption icon={<Languages/>} title="Language" subtitle={profile?.preferred_language || 'English'} />
            <ProfileOption icon={<Globe/>} title="Currency display" subtitle="USDT primary" />
            <ProfileOption icon={<Lock/>} title="Transaction PIN" subtitle="Change your secure PIN" />
            <ProfileOption icon={<SlidersHorizontal/>} title="Security settings" subtitle="Authentication and account controls" />
            <div className="flex items-center justify-between p-4"><div><p className="text-[11px] font-bold">Push notifications</p><p className="text-[9px] text-[#708A85]">Trade, deposit and account events</p></div><Switch checked={notifications} onCheckedChange={setNotifications}/></div>
            <div className="flex items-center justify-between p-4"><div><p className="text-[11px] font-bold">Biometric login</p><p className="text-[9px] text-[#708A85]">Use device security for sign-in</p></div><Switch checked={biometrics} onCheckedChange={setBiometrics}/></div>
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3"><div className="h-9 w-9 rounded-xl bg-[#E8F7F0] text-[#087F5B] flex items-center justify-center">{theme === 'dark' ? <Moon size={16}/> : <Sun size={16}/>}</div><div><p className="text-[11px] font-black">Appearance</p><p className="text-[9px] text-[#708A85]">Choose light or dark mode across the app</p></div></div>
              <div className="flex rounded-xl bg-[#F5F8F7] p-1">
                <button onClick={() => changeTheme('light')} className={cn('flex h-8 items-center gap-1 rounded-lg px-2.5 text-[9px] font-black', theme === 'light' ? 'bg-white text-[#087F5B] shadow-sm' : 'text-[#708A85]')}><Sun size={13}/> Light</button>
                <button onClick={() => changeTheme('dark')} className={cn('flex h-8 items-center gap-1 rounded-lg px-2.5 text-[9px] font-black', theme === 'dark' ? 'bg-[#16352F] text-white shadow-sm' : 'text-[#708A85]')}><Moon size={13}/> Dark</button>
              </div>
            </div>
          </Card>
        </section>

        <Dialog open={logoutOpen} onOpenChange={setLogoutOpen}>
          <DialogTrigger asChild><button className="w-full rounded-2xl border border-[#D6E1DE] bg-white py-4 text-[10px] font-black text-[#B94A48] flex items-center justify-center gap-2"><LogOut size={16}/> Sign out securely</button></DialogTrigger>
          <DialogContent className="max-w-[92vw] rounded-[28px] p-7"><DialogHeader><DialogTitle>Exit secure session?</DialogTitle><DialogDescription>You'll need to authenticate again to access your account.</DialogDescription></DialogHeader><div className="space-y-2"><button onClick={()=>void signOut()} className="w-full rounded-xl bg-[#183A36] py-3 text-[10px] font-black text-white">Yes, sign out</button><button onClick={()=>setLogoutOpen(false)} className="w-full rounded-xl bg-[#EEF2F1] py-3 text-[10px] font-black">Cancel</button></div></DialogContent>
        </Dialog>
      </div>
      <BottomNav />
    </main>
  )
}

function ProfileOption({icon,title,subtitle,onClick}:{icon:React.ReactNode,title:string,subtitle:string,onClick?:()=>void}){
 return <button onClick={onClick} className="w-full flex items-center justify-between p-4 text-left hover:bg-[#F8FAF9]"><div className="flex items-center gap-3"><div className="h-9 w-9 rounded-xl bg-[#E8F7F0] text-[#087F5B] flex items-center justify-center">{React.cloneElement(icon as React.ReactElement<{ size?: number }>,{size:16})}</div><div><p className="text-[11px] font-black">{title}</p><p className="mt-0.5 text-[9px] text-[#708A85]">{subtitle}</p></div></div><ChevronRight size={16} className="text-[#A4AFAB]"/></button>
}

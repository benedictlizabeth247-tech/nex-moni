"use client"

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  ChevronLeft, 
  Activity, 
  Plus, 
  TrendingUp, 
  LayoutDashboard,
  Megaphone,
  History,
  Settings,
  CircleDollarSign,
  Loader2,
  ChevronRight,
  ShieldCheck,
  ShoppingBag,
  Clock
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { NexLogo } from '@/components/ui/NexLogo'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useUser, useCollection, useDoc } from '@/supabase'
import { cn } from '@/lib/utils'

export default function MerchantDashboard() {
  const router = useRouter()
  const { user } = useUser()
  const [activeView, setActiveView] = useState<'overview' | 'ads' | 'orders'>('overview')

  const { data: profile, loading: profileLoading } = useDoc<any>(user ? { table: 'merchants', id: user.id } : null)
  const { data: ads, loading: adsLoading } = useCollection<any>({ table: 'p2p_ads', filter: { column: 'createdBy', value: user?.id } })
  const { data: orders, loading: ordersLoading } = useCollection<any>({ table: 'p2p_orders', filter: { column: 'sellerId', value: user?.id } })

  if (profileLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-white"><Loader2 className="animate-spin text-primary" size={32} /></div>
  }

  return (
    <main className="min-h-screen pb-32 bg-[#F8FAF9]">
      <header className="px-6 pt-10 pb-6 bg-white sticky top-0 z-30 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => router.push('/finances')} className="w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center text-[#1A1A1A]"><ChevronLeft size={22} /></button>
          <NexLogo />
          <button className="w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center text-primary"><Settings size={20} /></button>
        </div>
        
        <div className="flex items-center gap-2 mb-2">
           <Badge className="bg-emerald-50 text-emerald-500 border-none text-[9px] font-black uppercase tracking-widest">Approved Merchant</Badge>
           <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
           <span className="text-[10px] font-bold text-gray-400">Online</span>
        </div>
        <h1 className="text-nex-h2 font-bold text-[#1A1A1A]">Merchant Console</h1>
      </header>

      <div className="px-6 py-8">
        {activeView === 'overview' && (
          <div className="space-y-8 animate-in fade-in duration-500">
             <section className="grid grid-cols-2 gap-4">
                <StatCard label="Completed" value={profile?.totalTrades || '0'} sub="Total Trades" />
                <StatCard label="Rate" value={`${profile?.completionRate || '0'}%`} sub="Completion" />
                <StatCard label="Revenue" value={`₦${profile?.revenue?.toLocaleString() || '0'}`} sub="Earnings" />
                <StatCard label="Volume" value={`₦${profile?.tradingVolume?.toLocaleString() || '0'}`} sub="Vol (30d)" />
             </section>

             <Card className="p-8 border-none bg-gradient-to-br from-[#1A1A1A] to-[#333333] text-white rounded-[32px] shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
                <div className="relative z-10">
                   <div className="flex items-center gap-2 mb-2">
                      <CircleDollarSign size={16} className="text-primary" />
                      <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">Merchant Wallet</span>
                   </div>
                   <h2 className="text-[28px] font-black italic tracking-tighter mb-6">₦{profile?.revenue?.toLocaleString() || '0.00'}</h2>
                   <div className="flex gap-2">
                      <button className="flex-1 h-11 bg-primary text-white font-bold rounded-xl text-xs">Settlement</button>
                      <button className="flex-1 h-11 bg-white/10 text-white font-bold rounded-xl text-xs">Funding</button>
                   </div>
                </div>
             </Card>

             <section>
                <div className="flex items-center justify-between mb-4 px-1">
                   <h3 className="text-nex-body font-bold text-[#1A1A1A]">Recent Orders</h3>
                   <button onClick={() => setActiveView('orders')} className="text-primary text-[11px] font-bold uppercase tracking-widest">View All</button>
                </div>
                <div className="space-y-3">
                   {ordersLoading ? <Loader2 className="animate-spin mx-auto text-primary" /> : orders?.length === 0 ? (
                     <div className="py-10 text-center text-gray-400 text-xs font-medium bg-white rounded-3xl border border-dashed">No active orders</div>
                   ) : orders?.slice(0, 3).map((order: any) => (
                     <Card key={order.id} onClick={() => router.push(`/p2p/order/${order.id}`)} className="p-4 border-none shadow-soft rounded-2xl bg-white flex items-center justify-between">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-primary"><ShoppingBag size={20} /></div>
                           <div>
                              <p className="text-[13px] font-bold text-[#1A1A1A]">{order.type === 'buy' ? 'Selling' : 'Buying'} {order.asset}</p>
                              <p className="text-[11px] text-gray-400 font-medium">#{order.referenceId?.slice(-6)}</p>
                           </div>
                        </div>
                        <div className="text-right">
                           <p className="text-[13px] font-bold text-primary">₦{order.fiatAmount?.toLocaleString()}</p>
                           <p className="text-[9px] font-black uppercase text-amber-500">{order.status}</p>
                        </div>
                     </Card>
                   ))}
                </div>
             </section>
          </div>
        )}

        {activeView === 'ads' && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
             <div className="flex items-center justify-between mb-2">
                <h2 className="text-[18px] font-bold text-[#1A1A1A]">My Advertisements</h2>
                <button className="px-4 py-2 bg-primary text-white font-bold rounded-xl text-[11px] flex items-center gap-1.5 shadow-lg shadow-primary/20">
                   <Plus size={14} /> Create Ad
                </button>
             </div>
             
             <div className="space-y-4">
                {adsLoading ? <Loader2 className="animate-spin mx-auto text-primary" /> : ads?.length === 0 ? (
                   <div className="py-20 text-center bg-white rounded-[32px] border border-dashed border-gray-200">
                      <Megaphone size={32} className="text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">No Active Ads</p>
                   </div>
                ) : ads?.map((ad: any) => (
                  <Card key={ad.id} className="p-5 border border-gray-100 shadow-sm rounded-[28px] bg-white">
                     <div className="flex justify-between items-start mb-4">
                        <div>
                           <div className="flex items-center gap-2 mb-1">
                              <Badge className={cn("text-[9px] font-black uppercase tracking-tighter px-2", ad.type === 'buy' ? 'bg-emerald-50 text-emerald-500' : 'bg-red-50 text-red-500')}>
                                 {ad.type === 'buy' ? 'Buy (Taker Sells)' : 'Sell (Taker Buys)'}
                              </Badge>
                              <span className="text-[14px] font-black italic text-primary">{ad.asset}</span>
                           </div>
                           <p className="text-[16px] font-bold text-[#1A1A1A]">₦{ad.price?.toLocaleString()}</p>
                        </div>
                        <div className="flex flex-col items-end">
                           <div className="w-10 h-6 bg-emerald-500/20 rounded-full relative">
                              <div className="absolute right-1 top-1 w-4 h-4 bg-emerald-500 rounded-full" />
                           </div>
                           <span className="text-[9px] font-bold text-emerald-500 mt-1 uppercase">Active</span>
                        </div>
                     </div>
                     <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-50">
                        <div>
                           <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Limits</p>
                           <p className="text-[11px] font-bold text-[#1A1A1A]">₦{ad.minLimit?.toLocaleString()} - {ad.maxLimit?.toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                           <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Available</p>
                           <p className="text-[11px] font-bold text-[#1A1A1A]">{ad.availableQuantity} {ad.asset}</p>
                        </div>
                     </div>
                  </Card>
                ))}
             </div>
          </div>
        )}

        {activeView === 'orders' && (
           <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
              <h2 className="text-[18px] font-bold text-[#1A1A1A] mb-2">Trade History</h2>
              <div className="space-y-3">
                 {ordersLoading ? <Loader2 className="animate-spin mx-auto text-primary" /> : orders?.length === 0 ? (
                    <div className="py-20 text-center bg-white rounded-[32px] border border-dashed border-gray-200">
                       <History size={32} className="text-gray-300 mx-auto mb-4" />
                       <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">No Order History</p>
                    </div>
                 ) : orders?.map((order: any) => (
                    <Card key={order.id} className="p-4 border border-gray-50 rounded-2xl bg-white flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", order.status === 'completed' ? 'bg-emerald-50 text-emerald-500' : 'bg-amber-50 text-amber-500')}>
                             {order.status === 'completed' ? <ShieldCheck size={20} /> : <Clock size={20} />}
                          </div>
                          <div>
                             <p className="text-[13px] font-bold text-[#1A1A1A]">{order.asset} • {order.fiatAmount?.toLocaleString()} NGN</p>
                             <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">{order.status}</p>
                          </div>
                       </div>
                       <ChevronRight size={18} className="text-gray-300" />
                    </Card>
                 ))}
              </div>
           </div>
        )}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 h-24 bg-white border-t border-gray-100 flex items-center justify-around px-4 z-40 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.02)]">
         <NavButton active={activeView === 'overview'} onClick={() => setActiveView('overview')} icon={<LayoutDashboard />} label="Home" />
         <NavButton active={activeView === 'ads'} onClick={() => setActiveView('ads')} icon={<Megaphone />} label="Ads" />
         <button className="w-14 h-14 bg-primary text-white rounded-full flex items-center justify-center shadow-lg shadow-primary/20 -mt-10 border-4 border-[#F8FAF9] active:scale-95 transition-all"><Plus size={24} /></button>
         <NavButton active={activeView === 'orders'} onClick={() => setActiveView('orders')} icon={<Activity />} label="Orders" />
         <NavButton active={false} onClick={() => {}} icon={<History />} label="History" />
      </nav>
    </main>
  )
}

function StatCard({ label, value, sub }: any) {
  return (
    <Card className="p-5 border-none shadow-soft rounded-[28px] bg-white flex flex-col gap-1">
       <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{label}</span>
       <span className="text-[18px] font-black italic tracking-tighter text-[#1A1A1A]">{value}</span>
       <span className="text-[10px] font-medium text-gray-300">{sub}</span>
    </Card>
  )
}

function NavButton({ active, onClick, icon, label }: any) {
  return (
    <button onClick={onClick} className={cn("flex flex-col items-center gap-1 transition-all flex-1 py-2", active ? "text-primary" : "text-gray-300")}>
       {React.cloneElement(icon, { size: 22 })}
       <span className="text-[10px] font-bold tracking-tight">{label}</span>
    </button>
  )
}

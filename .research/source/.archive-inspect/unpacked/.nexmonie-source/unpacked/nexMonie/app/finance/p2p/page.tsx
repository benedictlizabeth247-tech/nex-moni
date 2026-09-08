"use client"

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  ChevronLeft, 
  Filter, 
  Search, 
  ShieldCheck, 
  Star, 
  ArrowRightLeft,
  Loader2,
  AlertCircle,
  Store,
  ChevronRight
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { NexLogo } from '@/components/ui/NexLogo'
import { TradeModal } from '@/components/p2p/TradeModal'
import { ActiveTradeScreen } from '@/components/p2p/ActiveTradeScreen'
import { P2PListing, P2PTrade } from '@/types/p2p'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/supabase'
import { useToast } from '@/hooks/use-toast'

export default function P2PMarketplace() {
  const router = useRouter()
  const { user } = useUser()
  const { toast } = useToast()
  
  const [activeTab, setActiveTab] = useState<'BUY' | 'SELL'>('BUY')
  const [assetType, setAssetType] = useState('USDT')
  const [selectedAd, setSelectedAd] = useState<P2PListing | null>(null)
  const [activeTrade, setActiveTrade] = useState<P2PTrade | null>(null)
  const [listings, setListings] = useState<P2PListing[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch Listings
  useEffect(() => {
    async function fetchListings() {
      setLoading(true)
      const { data, error } = await supabase
        .from('p2p_listings')
        .select('*')
        .eq('type', activeTab)
        .eq('asset_type', assetType)
        .eq('is_active', true)
        .order('exchange_rate', { ascending: activeTab === 'BUY' })

      if (error) {
        console.error(error)
      } else {
        setListings(data || [])
      }
      setLoading(false)
    }

    fetchListings()
  }, [activeTab, assetType])

  // Real-time Trade Listener
  useEffect(() => {
    if (!activeTrade) return

    const channel = supabase
      .channel(`trade_${activeTrade.id}`)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'p2p_trades',
        filter: `id=eq.${activeTrade.id}`
      }, (payload) => {
        setActiveTrade(payload.new as P2PTrade)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [activeTrade?.id])

  const handleInitiateTrade = async (fiat: number, asset: number) => {
    if (!user || !selectedAd) return

    const { data, error } = await supabase.rpc('p2p_create_trade', {
      p_listing_id: selectedAd.id,
      p_amount_fiat: fiat,
      p_amount_asset: asset,
    })

    if (error) {
      toast({ variant: 'destructive', title: 'Order Failed', description: error.message })
    } else {
      setActiveTrade(data as P2PTrade)
      setSelectedAd(null)
      toast({ title: 'Order Created', description: 'Please complete payment within 15 minutes.' })
    }
  }

  const handlePaymentMarked = async () => {
    if (!activeTrade) return
    const { data, error } = await supabase.rpc('p2p_mark_paid', { p_trade_id: activeTrade.id })
    if (error) toast({ variant: 'destructive', title: 'Error', description: error.message })
    else setActiveTrade(data as P2PTrade)
  }

  const handleCancelTrade = async () => {
    if (!activeTrade) return
    if (!confirm('Are you sure you want to cancel this trade?')) return
    
    const { error } = await supabase.rpc('p2p_cancel_trade', { p_trade_id: activeTrade.id })
    if (error) toast({ variant: 'destructive', title: 'Error', description: error.message })
    else setActiveTrade(null)
  }

  return (
    <main className="min-h-screen bg-[#F8FAF9] pb-20">
      <header className="px-6 pt-10 pb-4 bg-white sticky top-0 z-30 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => router.back()} className="w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center text-[#1A1A1A]">
            <ChevronLeft size={22} />
          </button>
          <NexLogo />
          <div className="w-10" />
        </div>

        {!activeTrade && (
          <div className="flex w-full items-stretch justify-between overflow-hidden rounded-[22px] bg-gray-100 p-0">
            <button 
              onClick={() => setActiveTab('BUY')}
              className={cn(
                "flex-1 min-w-0 py-3 text-xs font-black uppercase transition-all",
                activeTab === 'BUY' ? "bg-emerald-500 text-white shadow-lg" : "text-gray-400"
              )}
            >
              BUY
            </button>
            <button 
              onClick={() => setActiveTab('SELL')}
              className={cn(
                "flex-1 min-w-0 py-3 text-xs font-black uppercase transition-all",
                activeTab === 'SELL' ? "bg-red-500 text-white shadow-lg" : "text-gray-400"
              )}
            >
              SELL
            </button>
          </div>
        )}
      </header>

      <div className="px-6 py-6">
        {activeTrade ? (
          <ActiveTradeScreen 
            trade={activeTrade} 
            onPaymentMarked={handlePaymentMarked}
            onCancel={handleCancelTrade}
          />
        ) : (
          <div className="space-y-6">
            <button
              onClick={() => router.push('/merchant-registration')}
              className="w-full flex items-center justify-between gap-3 p-4 rounded-[22px] bg-white border border-gray-100 shadow-sm active:scale-[0.99] transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Store size={18} />
                </div>
                <div className="text-left">
                  <p className="text-[13px] font-bold text-[#1A1A1A]">Become a Merchant</p>
                  <p className="text-[11px] text-gray-400 font-medium">Post ads and trade with zero fees</p>
                </div>
              </div>
              <ChevronRight size={18} className="text-gray-300" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input placeholder="Amount..." className="w-full h-12 pl-11 pr-4 bg-white rounded-xl border-none shadow-sm text-sm" />
              </div>
              <button className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-gray-400 shadow-sm border border-gray-100">
                <Filter size={20} />
              </button>
            </div>

            <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
              {['USDT'].map(asset => (
                <button 
                  key={asset}
                  onClick={() => setAssetType(asset)}
                  className={cn(
                    "px-5 py-2 rounded-full text-[11px] font-bold uppercase border transition-all",
                    assetType === asset ? "bg-[#1A1A1A] text-white border-[#1A1A1A]" : "bg-white text-gray-400 border-gray-100"
                  )}
                >
                  {asset}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <Loader2 className="animate-spin text-primary" size={24} />
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Fetching Offers...</p>
                </div>
              ) : listings.length === 0 ? (
                <div className="py-20 text-center bg-white rounded-[32px] border border-dashed border-gray-200">
                   <AlertCircle className="mx-auto text-gray-300 mb-4" size={48} />
                   <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">No active {activeTab} ads</p>
                </div>
              ) : (
                listings.map((ad) => (
                  <Card key={ad.id} className="p-6 border-none shadow-soft rounded-[32px] bg-white group hover:shadow-md transition-all">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-primary font-black italic border border-gray-100">
                          {ad.advertiser_name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1">
                            <h4 className="text-sm font-bold text-[#1A1A1A]">{ad.advertiser_name}</h4>
                            <ShieldCheck size={14} className="text-blue-500" fill="currentColor" />
                          </div>
                          <p className="text-[10px] text-gray-400 font-bold tabular-nums">
                            {ad.total_orders} orders | {ad.completion_rate}% completion
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black italic text-primary tracking-tighter tabular-nums">
                          ₦{ad.exchange_rate.toLocaleString()}
                        </p>
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">NGN / {ad.asset_type}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 py-4 border-y border-gray-50 mb-4">
                      <div>
                        <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-0.5">Available</p>
                        <p className="text-[12px] font-black italic text-gray-600 tabular-nums">{ad.available_amount} {ad.asset_type}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Limits</p>
                        <p className="text-[12px] font-black italic text-[#1A1A1A] tabular-nums">₦{ad.min_limit.toLocaleString()} - ₦{ad.max_limit.toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex gap-1">
                        {ad.payment_methods.map(p => (
                          <span key={p} className="bg-emerald-50 text-emerald-600 border-none px-2 py-0.5 rounded-full text-[8px] font-bold uppercase">{p}</span>
                        ))}
                      </div>
                      <button 
                        onClick={() => setSelectedAd(ad)}
                        className={cn(
                          "px-8 py-2.5 rounded-xl font-black italic text-[11px] shadow-lg active:scale-95 transition-all text-white",
                          activeTab === 'BUY' ? "bg-emerald-500 shadow-emerald-500/20" : "bg-red-500 shadow-red-500/20"
                        )}
                      >
                        {activeTab} {ad.asset_type}
                      </button>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <TradeModal 
        listing={selectedAd} 
        onClose={() => setSelectedAd(null)}
        onConfirm={handleInitiateTrade}
      />
    </main>
  )
}

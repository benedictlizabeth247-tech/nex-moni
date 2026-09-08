"use client"

import React, { useState, useEffect } from 'react'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ShieldCheck, Info, Loader2, ArrowRight, Lock } from 'lucide-react'
import { P2PListing } from '@/types/p2p'
import { cn } from '@/lib/utils'

interface TradeModalProps {
  listing: P2PListing | null
  onClose: () => void
  onConfirm: (fiatAmount: number, assetAmount: number) => Promise<void>
}

export function TradeModal({ listing, onClose, onConfirm }: TradeModalProps) {
  const [fiatAmount, setFiatAmount] = useState<string>('')
  const [assetAmount, setAssetAmount] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (listing && fiatAmount) {
      const calculated = parseFloat(fiatAmount) / listing.exchange_rate
      setAssetAmount(calculated.toFixed(6))
    } else {
      setAssetAmount('')
    }
  }, [fiatAmount, listing])

  const handleAssetChange = (val: string) => {
    setAssetAmount(val)
    if (listing && val) {
      const calculated = parseFloat(val) * listing.exchange_rate
      setFiatAmount(calculated.toFixed(2))
    } else {
      setFiatAmount('')
    }
  }

  const isInvalid = !listing || 
    !fiatAmount || 
    parseFloat(fiatAmount) < listing.min_limit || 
    parseFloat(fiatAmount) > listing.max_limit

  const handleSubmit = async () => {
    if (isInvalid) return
    setIsSubmitting(true)
    try {
      await onConfirm(parseFloat(fiatAmount), parseFloat(assetAmount))
    } catch (error) {
      console.error(error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!listing) return null

  return (
    <Dialog open={!!listing} onOpenChange={onClose}>
      <DialogContent className="max-w-md rounded-[32px] p-0 overflow-hidden border-none shadow-2xl bg-white">
        <div className="p-8 space-y-6">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black italic tracking-tighter text-[#1A1A1A]">
              {listing.type === 'BUY' ? 'Buy' : 'Sell'} {listing.asset_type}
            </DialogTitle>
          </DialogHeader>

          <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Price</span>
              <span className="text-lg font-black italic text-primary">₦{listing.exchange_rate.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Limits</span>
              <span className="text-xs font-bold text-[#1A1A1A]">₦{listing.min_limit.toLocaleString()} - ₦{listing.max_limit.toLocaleString()}</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest ml-1">I want to pay</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black italic text-gray-400">₦</span>
                <Input 
                  value={fiatAmount}
                  onChange={(e) => setFiatAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder="0.00"
                  className="h-16 pl-9 rounded-2xl border-none bg-gray-50 font-black italic text-xl shadow-inner focus:ring-1 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest ml-1">I will receive</label>
              <div className="relative">
                <Input 
                  value={assetAmount}
                  onChange={(e) => handleAssetChange(e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder="0.000000"
                  className="h-16 rounded-2xl border-none bg-gray-50 font-black italic text-xl shadow-inner focus:ring-1 focus:ring-primary/20"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-gray-400 uppercase text-xs">{listing.asset_type}</span>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 p-4 rounded-2xl flex gap-3 border border-amber-100">
            <Lock className="text-amber-500 shrink-0" size={20} />
            <p className="text-[11px] text-amber-700 leading-relaxed font-medium">
              Assets are held safely in <b>nexEscrow</b>. The seller cannot withdraw funds until you confirm payment or the trade is finalized.
            </p>
          </div>

          <button 
            onClick={handleSubmit}
            disabled={isInvalid || isSubmitting}
            className="w-full py-5 bg-primary text-white font-bold rounded-[22px] shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="animate-spin" /> : <>Proceed to Trade <ArrowRight size={18} /></>}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

"use client"

import React, { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { 
  Clock, 
  Copy, 
  ShieldAlert, 
  CheckCircle2, 
  Loader2, 
  MessageSquare,
  AlertCircle
} from 'lucide-react'
import { P2PTrade } from '@/types/p2p'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase'

interface ActiveTradeScreenProps {
  trade: P2PTrade
  onPaymentMarked: () => Promise<void>
  onCancel: () => Promise<void>
}

export function ActiveTradeScreen({ trade, onPaymentMarked, onCancel }: ActiveTradeScreenProps) {
  const { toast } = useToast()
  const [timeLeft, setTimeLeft] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [messages, setMessages] = useState<Array<{id:string; sender_id:string; body:string; created_at:string}>>([])
  const [message, setMessage] = useState('')
  const [chatOpen, setChatOpen] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    void supabase.auth.getUser().then(({ data }) => { if (mounted) setCurrentUserId(data.user?.id ?? null) })
    const loadMessages = async () => {
      const { data } = await supabase.from('p2p_trade_messages').select('id,sender_id,body,created_at').eq('trade_id', trade.id).order('created_at', { ascending: true })
      if (mounted) setMessages((data ?? []) as Array<{id:string; sender_id:string; body:string; created_at:string}>)
    }
    void loadMessages()
    const channel = supabase.channel(`p2p-chat-${trade.id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'p2p_trade_messages', filter: `trade_id=eq.${trade.id}` }, payload => {
      if (mounted) setMessages(prev => prev.some(m => m.id === String(payload.new.id)) ? prev : [...prev, payload.new as any])
    }).subscribe()
    return () => { mounted = false; void supabase.removeChannel(channel) }
  }, [trade.id])

  useEffect(() => {
    const calculateTimeLeft = () => {
      const expiry = new Date(trade.escrow_timer_expires_at).getTime()
      const now = new Date().getTime()
      const diff = Math.max(0, Math.floor((expiry - now) / 1000))
      setTimeLeft(diff)
    }

    calculateTimeLeft()
    const timer = setInterval(calculateTimeLeft, 1000)
    return () => clearInterval(timer)
  }, [trade.escrow_timer_expires_at])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast({ title: "Copied!", description: `${label} saved to clipboard.` })
  }

  const handlePayment = async () => {
    setIsSubmitting(true)
    try {
      if (currentUserId === trade.seller_id && trade.status === 'payment_marked') {
        const { data, error } = await supabase.rpc('p2p_release_trade', { p_trade_id: trade.id })
        if (error) throw new Error(error.message)
        toast({ title: 'USDT released', description: 'The trade has been completed and the buyer credited.' })
        return
      }
      await onPaymentMarked()
    } catch (e) {
      toast({ variant:'destructive', title:'Trade action failed', description:e instanceof Error ? e.message : 'Unable to update the trade.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (trade.status === 'completed') {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-in zoom-in-95 duration-500">
        <div className="w-24 h-24 bg-emerald-500 rounded-[40px] flex items-center justify-center text-white shadow-2xl shadow-emerald-500/20 mb-8">
          <CheckCircle2 size={56} />
        </div>
        <h2 className="text-[32px] font-black italic tracking-tighter text-[#1A1A1A] mb-2">Trade Successful!</h2>
        <p className="text-gray-500 font-medium px-8 leading-relaxed max-w-xs">
          {Number(trade.trade_amount_asset).toFixed(6)} assets have been released to your wallet.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between bg-white p-6 rounded-[32px] shadow-sm">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
            timeLeft < 300 ? "bg-red-50 text-red-500" : "bg-primary/10 text-primary"
          )}>
            <Clock size={20} className={cn(timeLeft < 300 && "animate-pulse")} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Time Remaining</p>
            <p className={cn("text-xl font-black italic tabular-nums", timeLeft < 300 ? "text-red-500" : "text-[#1A1A1A]")}>
              {formatTime(timeLeft)}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Amount to Pay</p>
          <p className="text-xl font-black italic text-primary">₦{Number(trade.trade_amount_fiat).toLocaleString()}</p>
        </div>
      </div>

      <Card className="p-6 border-none bg-white rounded-[32px] shadow-sm space-y-5">
        <div className="flex items-center justify-between">
           <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Seller Bank Details</h3>
           <Badge variant="outline" className="text-[10px] font-black uppercase text-blue-500">Verified Account</Badge>
        </div>
        
        <PaymentDetail 
          label="Bank Name" 
          value={trade.seller_bank_details?.bank_name || 'Not provided'} 
          onCopy={(val) => handleCopy(val, 'Bank Name')} 
        />
        <PaymentDetail 
          label="Account Name" 
          value={trade.seller_bank_details?.account_name || 'Not provided'} 
          onCopy={(val) => handleCopy(val, 'Account Name')} 
        />
        <PaymentDetail 
          label="Account Number" 
          value={trade.seller_bank_details?.account_number || 'Not provided'} 
          onCopy={(val) => handleCopy(val, 'Account Number')} 
        />
        <PaymentDetail 
          label="Reference" 
          value={trade.id.slice(0, 8).toUpperCase()} 
          onCopy={(val) => handleCopy(val, 'Reference')} 
        />
      </Card>

      <div className="flex gap-3">
        <button 
          onClick={handlePayment}
          disabled={isSubmitting || (currentUserId === trade.buyer_id && trade.status === 'payment_marked') || trade.status === 'completed' || trade.status === 'cancelled'}
          className="flex-[2] py-5 bg-primary text-white font-bold rounded-[22px] shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
        >
          {isSubmitting ? <Loader2 className="animate-spin" /> : currentUserId === trade.seller_id ? (trade.status === 'payment_marked' ? 'Release USDT' : 'Awaiting Buyer Payment') : (trade.status === 'payment_marked' ? 'Awaiting Release' : 'I Have Paid')}
        </button>
        <button 
          onClick={onCancel}
          className="flex-1 py-5 bg-gray-100 text-gray-500 font-bold rounded-[22px] active:scale-95 transition-all"
        >
          Cancel
        </button>
      </div>

      <button onClick={() => setChatOpen(v => !v)} className="w-full py-4 flex items-center justify-center gap-2 text-primary font-bold text-xs uppercase tracking-widest bg-primary/5 rounded-2xl">
        <MessageSquare size={16} /> {chatOpen ? 'Hide trade chat' : 'Open trade chat'}
      </button>
      {chatOpen && <Card className="p-4 border-none bg-white rounded-[28px] shadow-sm">
        <div className="max-h-56 space-y-2 overflow-y-auto">
          {messages.length ? messages.map(m => <div key={m.id} className={cn('max-w-[82%] rounded-2xl px-3 py-2 text-[10px]', m.sender_id === trade.buyer_id ? 'ml-auto bg-primary text-white' : 'bg-gray-100 text-[#1A1A1A]')}><p>{m.body}</p><span className="mt-1 block text-[8px] opacity-60">{new Date(m.created_at).toLocaleTimeString()}</span></div>) : <p className="py-6 text-center text-[10px] text-gray-400">No messages yet.</p>}
        </div>
        <form onSubmit={async e => { e.preventDefault(); const body = message.trim(); if (!body) return; const { error } = await supabase.rpc('p2p_send_trade_message', { p_trade_id: trade.id, p_body: body }); if (error) toast({ variant:'destructive', title:'Message failed', description:error.message }); else setMessage('') }} className="mt-3 flex gap-2">
          <input value={message} onChange={e => setMessage(e.target.value)} maxLength={2000} placeholder="Message seller" className="h-11 min-w-0 flex-1 rounded-xl border border-gray-100 bg-gray-50 px-3 text-[10px] outline-none" />
          <button type="submit" className="rounded-xl bg-primary px-4 text-[10px] font-black text-white">Send</button>
        </form>
      </Card>}
    </div>
  )
}

function PaymentDetail({ label, value, onCopy }: { label: string; value: string; onCopy: (val: string) => void }) {
  return (
    <div className="flex justify-between items-center group">
      <div>
        <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest mb-0.5">{label}</p>
        <p className="text-[15px] font-black italic text-[#1A1A1A] tabular-nums">{value}</p>
      </div>
      <button 
        onClick={() => onCopy(value)}
        className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 hover:text-primary transition-colors border border-gray-100"
      >
        <Copy size={16} />
      </button>
    </div>
  )
}

function Badge({ children, variant, className }: any) {
  return (
    <span className={cn(
      "px-2 py-0.5 rounded-full border text-[10px]",
      variant === 'outline' ? "border-blue-200 bg-blue-50 text-blue-600" : "",
      className
    )}>
      {children}
    </span>
  )
}

"use client"

import React, { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  ChevronLeft, 
  Search, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Filter, 
  Download, 
  Share2, 
  Loader2,
  Calendar,
  X
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NexLogo } from '@/components/ui/NexLogo'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils'
import { useUser } from '@/supabase'
import { format, isToday, isYesterday } from 'date-fns'
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import { TransactionService } from '@/services/transaction.service'
import { Transaction } from '@/types'

export default function TransactionHistory() {
  const router = useRouter()
  const { user } = useUser()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null)
  
  // Architectural State
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    async function loadTransactions() {
      if (!user) return;
      try {
        const data = await TransactionService.getRecentTransactions(user.id);
        setTransactions(data);
      } catch (e) {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    loadTransactions();
  }, [user]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => 
      tx.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.category?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [transactions, searchQuery])

  const groupedTransactions = useMemo(() => {
    const groups: Record<string, Transaction[]> = {}
    filteredTransactions.forEach(tx => {
      const date = tx.timestamp ? new Date(tx.timestamp) : null
      let groupKey = 'Earlier'
      if (date) {
        if (isToday(date)) groupKey = 'Today'
        else if (isYesterday(date)) groupKey = 'Yesterday'
        else groupKey = format(date, 'MMMM d, yyyy')
      }
      if (!groups[groupKey]) groups[groupKey] = []
      groups[groupKey].push(tx)
    })
    return groups
  }, [filteredTransactions])

  return (
    <main className="min-h-screen pb-32 bg-[#F8FAF9]">
      <header className="px-6 pt-8 pb-4 bg-white sticky top-0 z-30 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => router.back()} className="w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center text-[#1A1A1A] active:scale-90 transition-all border border-gray-100">
            <ChevronLeft size={22} />
          </button>
          <NexLogo />
          <div className="w-10" />
        </div>
        <div>
          <h1 className="text-[22px] font-bold text-[#1A1A1A] leading-tight mb-1">Activity Log</h1>
          <p className="text-[14px] text-gray-500 font-medium">Detailed history of your Elite account.</p>
        </div>
      </header>

      <div className="px-6 py-6">
        <div className="relative group mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors" size={20} />
          <Input 
            placeholder="Search activities..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 h-14 rounded-2xl bg-white border-none shadow-soft text-[15px] focus-visible:ring-1 focus-visible:ring-primary/20" 
          />
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="animate-spin text-primary" size={32} />
            <p className="text-sm text-gray-400 font-medium tracking-tight">Syncing Ledger...</p>
          </div>
        ) : error ? (
           <div className="text-center py-20 bg-white rounded-[32px] shadow-soft border border-red-50 p-8">
             <X size={32} className="text-red-400 mx-auto mb-4" />
             <h3 className="text-[16px] font-bold text-[#1A1A1A]">Network Sync Issue</h3>
             <button onClick={() => window.location.reload()} className="text-primary font-bold text-sm mt-2">Retry Sync</button>
           </div>
        ) : Object.keys(groupedTransactions).length === 0 ? (
          <div className="text-center py-20 bg-white rounded-[32px] shadow-soft border border-gray-100">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar size={32} className="text-gray-200" />
            </div>
            <h3 className="text-[16px] font-bold text-[#1A1A1A] mb-1">No activities found</h3>
            <p className="text-[13px] text-gray-400 px-10">Activities will appear here once identified by the circle.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedTransactions).map(([group, txs]) => (
              <div key={group} className="space-y-4">
                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.2em] ml-2">{group}</h3>
                <div className="space-y-3">
                  {txs.map((tx) => (
                    <TransactionItem 
                      key={tx.id} 
                      tx={tx} 
                      onClick={() => setSelectedTx(tx)} 
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!selectedTx} onOpenChange={() => setSelectedTx(null)}>
        <DialogContent className="max-w-[90vw] sm:max-w-md rounded-[40px] p-0 border-none shadow-2xl overflow-hidden bg-white">
          <div className="relative p-8">
            <div className="flex flex-col items-center text-center mb-8">
              <div className={cn(
                "w-16 h-16 rounded-[24px] flex items-center justify-center mb-4 shadow-lg",
                selectedTx?.type === 'income' ? "bg-emerald-50 text-emerald-600" : "bg-primary/5 text-primary"
              )}>
                {selectedTx?.type === 'income' ? <ArrowDownLeft size={32} /> : <ArrowUpRight size={32} />}
              </div>
              <h2 className="text-[20px] font-bold text-[#1A1A1A] mb-1">{selectedTx?.title}</h2>
              <p className="text-[12px] text-gray-400 font-bold uppercase tracking-widest">{selectedTx?.category}</p>
            </div>

            <div className="space-y-5 px-2">
              <DetailRow label="Amount" value={`${selectedTx?.type === 'income' ? '+' : '-'}${selectedTx?.amount?.toLocaleString()} USDT`} isBold />
              <DetailRow label="Status" value={selectedTx?.status || 'Completed'} isSuccess />
              <DetailRow label="Date" value={selectedTx?.timestamp ? format(new Date(selectedTx.timestamp), 'MMM d, yyyy • h:mm a') : '...'} />
              <DetailRow label="Reference" value={selectedTx?.referenceId || 'N/A'} />
              {selectedTx?.recipient && <DetailRow label="Recipient" value={selectedTx.recipient} />}
            </div>

            <div className="mt-10 grid grid-cols-2 gap-3">
              <button className="py-4 bg-gray-100 text-[#1A1A1A] font-bold rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all">
                <Download size={18} /> Receipt
              </button>
              <button className="py-4 bg-primary text-white font-bold rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-primary/20">
                <Share2 size={18} /> Share
              </button>
            </div>
          </div>
          <div className="bg-gray-50 p-4 text-center">
             <NexLogo className="justify-center opacity-30" />
          </div>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </main>
  )
}

function TransactionItem({ tx, onClick }: { tx: Transaction, onClick: () => void }) {
  const isIncome = tx.type === 'income'
  const date = tx.timestamp ? new Date(tx.timestamp) : null
  
  return (
    <Card 
      onClick={onClick}
      className="p-4 border-none shadow-soft rounded-[24px] bg-white flex items-center justify-between active:scale-[0.98] transition-all cursor-pointer group"
    >
      <div className="flex items-center gap-4">
        <div className={cn(
          "w-12 h-12 rounded-[16px] flex items-center justify-center transition-colors shadow-sm",
          isIncome ? "bg-emerald-50 text-emerald-600" : "bg-gray-50 text-gray-400 group-hover:bg-primary/5 group-hover:text-primary"
        )}>
          {isIncome ? <ArrowDownLeft size={22} /> : <ArrowUpRight size={22} />}
        </div>
        <div>
          <h4 className="text-[14px] font-bold text-[#1A1A1A] leading-tight mb-0.5">{tx.title}</h4>
          <p className="text-[11px] text-gray-400 font-medium">{date ? format(date, 'h:mm a') : 'Pending...'}</p>
        </div>
      </div>
      <div className="text-right">
        <div className={cn("text-[15px] font-bold mb-0.5", isIncome ? "text-emerald-500" : "text-[#1A1A1A]")}>
          {isIncome ? '+' : '-'}{tx.amount?.toLocaleString()} USDT
        </div>
        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter px-2 py-0.5 bg-gray-50 rounded-full border border-gray-100">
          {tx.category}
        </span>
      </div>
    </Card>
  )
}

function DetailRow({ label, value, isBold, isSuccess }: { label: string, value: string, isBold?: boolean, isSuccess?: boolean }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">{label}</span>
      <span className={cn(
        "text-[14px] font-bold text-right",
        isBold ? "text-primary text-[18px]" : "text-[#1A1A1A]",
        isSuccess && "text-emerald-500"
      )}>
        {value}
      </span>
    </div>
  )
}

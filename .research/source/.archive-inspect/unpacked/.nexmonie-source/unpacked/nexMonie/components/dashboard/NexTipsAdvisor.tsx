"use client"

import React, { useEffect, useState } from 'react'
import { Sparkles, ArrowRight, Loader2, Info } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { getPersonalizedFinancialAdvice, type PersonalizedFinancialAdviceOutput } from '@/ai/flows/personalized-financial-advice-flow'
import { useUser, useCollection } from '@/supabase'

export function NexTipsAdvisor() {
  const { user } = useUser()
  const [advice, setAdvice] = useState<PersonalizedFinancialAdviceOutput | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const { data: wallets } = useCollection(user ? { table: 'wallets', userId: user.id, limit: 1 } : null)
  const wallet = wallets?.[0]

  const { data: transactions } = useCollection(user ? {
    table: 'transactions',
    userId: user.id,
    order: 'created_at',
    limit: 5
  } : null)

  useEffect(() => {
    async function fetchAdvice() {
      if (!user || !wallet) return;

      try {
        const spendingPatterns = transactions?.length 
          ? `User has ${transactions.length} recent transactions in categories like ${Array.from(new Set(transactions.map(t => t.category))).join(', ')}.`
          : "No transaction history yet. User is just starting their nex Monie journey.";

        const result = await getPersonalizedFinancialAdvice({
          spendingPatterns,
          currentBalance: wallet.available_balance || 0,
          financialGoals: "Grow wealth sustainably and automate daily savings."
        })
        setAdvice(result)
        setError(false)
      } catch (error) {
        console.error("Advice generation error:", error)
        setError(true)
      } finally {
        setLoading(false)
      }
    }

    if (wallet && !advice && loading) {
      fetchAdvice()
    } else if (!wallet && !loading) {
      setLoading(false)
    }
  }, [user, wallet, transactions, advice, loading])

  if (loading && !advice) {
    return (
      <Card className="p-8 bg-white border border-gray-100 shadow-soft rounded-[32px] h-40 flex flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-primary" size={24} />
        <span className="text-[12px] font-bold text-gray-400 uppercase tracking-[0.2em]">Syncing Intelligence...</span>
      </Card>
    )
  }

  if (error && !advice) {
    return (
      <Card className="p-6 bg-white border border-gray-100 shadow-soft rounded-[32px] flex items-center gap-4">
        <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400">
          <Info size={24} />
        </div>
        <div className="flex-1">
          <h4 className="text-[14px] font-bold text-[#1A1A1A]">Advisor Offline</h4>
          <p className="text-[11px] text-gray-400 font-medium leading-tight">Please ensure your AI environment is configured correctly.</p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="bg-white border border-gray-100 shadow-soft p-8 rounded-[40px] flex items-start gap-6 relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl group-hover:bg-primary/10 transition-colors" />
      
      <div className="w-16 h-16 bg-primary rounded-[24px] flex items-center justify-center text-white shrink-0 shadow-xl shadow-primary/20 relative z-10">
        <Sparkles size={32} />
      </div>
      <div className="flex-1 relative z-10">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[12px] font-bold text-primary uppercase tracking-[0.25em]">
            <span className="font-light opacity-60">nex</span>Monie Intelligence
          </span>
        </div>
        <p className="text-[17px] text-[#1A1A1A] font-bold mb-5 leading-tight tracking-tight">
          {advice?.tips?.[0] || "Optimize your wealth for elite growth."}
        </p>
        <button className="flex items-center text-[13px] font-bold text-primary group/btn active:opacity-60 transition-all border-b border-primary/20 pb-0.5">
          Elite Analysis <ArrowRight size={16} className="ml-2 group-hover/btn:translate-x-1.5 transition-transform" />
        </button>
      </div>
    </Card>
  )
}

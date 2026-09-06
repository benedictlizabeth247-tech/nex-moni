"use client"

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  ChevronLeft, 
  Landmark, 
  TrendingUp, 
  Plus, 
  ArrowRight, 
  ShieldCheck, 
  Calendar,
  Loader2,
  CheckCircle2,
  Wallet
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { getSavingsOverview, getActivePlans, type SavingsPlan, type SavingsType } from '@/services/savingsService'
import { getFxRate, convertToUsd, formatUsd } from '@/services/currencyService'

export default function SavingsWorkflow() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [overview, setSavingsOverview] = useState<any>(null)
  const [plans, setPlans] = useState<SavingsPlan[]>([])
  const [ngnToUsd, setNgnToUsd] = useState<number | null>(null)
  
  const [stage, setStage] = useState<'overview' | 'create-type' | 'create-input' | 'success'>('overview')
  const [selectedType, setSelectedType] = useState<SavingsType | null>(null)

  useEffect(() => {
    async function fetchData() {
      const [ov, pl, fx] = await Promise.all([getSavingsOverview(), getActivePlans(), getFxRate('NGN', 'USD')])
      setSavingsOverview(ov)
      setPlans(pl)
      setNgnToUsd(fx?.rate ?? null)
      setLoading(false)
    }
    fetchData()
  }, [])

  if (stage === 'overview') {
    return (
      <main className="min-h-screen pb-32 bg-[#F8FAF9]">
        <header className="px-6 pt-8 pb-4 bg-white sticky top-0 z-30 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => router.push('/')} className="w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center text-[#1A1A1A] active:scale-90 transition-all border border-gray-100">
              <ChevronLeft size={22} />
            </button>
            <h1 className="text-[18px] font-bold text-[#1A1A1A]">Savings</h1>
            <div className="w-10" />
          </div>
        </header>

        <div className="px-6 py-6">
          <Card className="bg-gradient-to-br from-[#1A1A1A] to-[#333333] p-8 border-none rounded-[32px] text-white mb-8 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Total Savings</span>
                <ShieldCheck size={12} className="text-emerald-500" />
              </div>
              <h2 className="text-[32px] font-black italic tracking-tighter mb-4">
                {loading ? "—" : formatUsd(convertToUsd(Number(overview?.totalSavings), 'NGN', ngnToUsd))}
              </h2>
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs bg-emerald-500/10 w-fit px-3 py-1.5 rounded-full">
                <TrendingUp size={12} />
                +{formatUsd(convertToUsd(Number(overview?.interestEarned), 'NGN', ngnToUsd))} Interest
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <button onClick={() => setStage('create-type')} className="h-14 bg-primary text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-primary/20 active:scale-95 transition-all">
              <Plus size={20} /> Create Plan
            </button>
            <button className="h-14 bg-white border border-gray-100 text-[#1A1A1A] font-bold rounded-2xl flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all">
              <Wallet size={20} className="text-primary" /> Withdraw
            </button>
          </div>

          <section>
            <h3 className="text-[15px] font-bold text-[#1A1A1A] mb-4">Active Plans</h3>
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-24 w-full rounded-3xl" />
                <Skeleton className="h-24 w-full rounded-3xl" />
              </div>
            ) : plans.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-3xl border border-dashed border-gray-200">
                <p className="text-gray-400 font-medium">No active plans yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {plans.map(plan => (
                  <Card key={plan.id} className="p-5 border-none shadow-soft rounded-[24px] bg-white flex items-center justify-between group active:scale-[0.98] transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary">
                        <Landmark size={24} />
                      </div>
                      <div>
                        <h4 className="font-bold text-[#1A1A1A] text-[15px]">{plan.title}</h4>
                        <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest">{plan.type} • {plan.interestRate}% APR</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-black italic text-[#1A1A1A]">{formatUsd(convertToUsd(plan.balance, 'NGN', ngnToUsd))}</p>
                      <ArrowRight size={16} className="ml-auto text-gray-200" />
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </div>
        <BottomNav />
      </main>
    )
  }

  if (stage === 'create-type') {
    return (
      <main className="min-h-screen pb-32 bg-[#F8FAF9]">
        <header className="px-6 pt-8 pb-4 bg-white sticky top-0 z-30">
          <div className="flex items-center justify-between">
            <button onClick={() => setStage('overview')} className="w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center text-[#1A1A1A]"><ChevronLeft size={22} /></button>
            <h1 className="text-[18px] font-bold text-[#1A1A1A]">Select Plan Type</h1>
            <div className="w-10" />
          </div>
        </header>
        <div className="px-6 py-8 space-y-4">
          <PlanOption 
            type="Flexible" 
            title="nex Flex" 
            desc="Save and withdraw anytime. Earn 12% APR." 
            icon={<TrendingUp />} 
            color="bg-emerald-50"
            iconColor="text-emerald-500"
            onClick={() => { setSelectedType('Flexible'); setStage('create-input'); }}
          />
          <PlanOption 
            type="Locked" 
            title="nex Lock" 
            desc="Lock funds for 3-12 months. Earn up to 18.5% APR." 
            icon={<Landmark />} 
            color="bg-primary/5"
            iconColor="text-primary"
            onClick={() => { setSelectedType('Locked'); setStage('create-input'); }}
          />
          <PlanOption 
            type="Goal" 
            title="Goal Savings" 
            desc="Save towards a specific target. Automated schedules." 
            icon={<Calendar />} 
            color="bg-accent/5"
            iconColor="text-accent"
            onClick={() => { setSelectedType('Goal'); setStage('create-input'); }}
          />
        </div>
      </main>
    )
  }

  return null
}

function PlanOption({ type, title, desc, icon, color, iconColor, onClick }: any) {
  return (
    <Card onClick={onClick} className="p-6 border-none shadow-soft rounded-[32px] bg-white flex items-center gap-6 cursor-pointer active:scale-[0.98] transition-all group">
      <div className={cn("w-14 h-14 rounded-[22px] flex items-center justify-center shrink-0", color, iconColor)}>
        {React.cloneElement(icon, { size: 28 })}
      </div>
      <div className="flex-1">
        <h4 className="font-bold text-[#1A1A1A] text-[16px] mb-1">{title}</h4>
        <p className="text-[12px] text-gray-500 leading-tight font-medium">{desc}</p>
      </div>
      <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
        <ArrowRight size={16} />
      </div>
    </Card>
  )
}

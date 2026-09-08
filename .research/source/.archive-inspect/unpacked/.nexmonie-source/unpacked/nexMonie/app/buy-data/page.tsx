
"use client"

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  ChevronLeft, 
  Wifi, 
  CheckCircle2, 
  Loader2, 
  Smartphone
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NexLogo } from '@/components/ui/NexLogo'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils'
import { useUser, useCollection } from '@/supabase'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'

const NETWORKS = ['MTN', 'Airtel', 'Glo', '9mobile']

type DataPlan = {
  id: string
  title: string
  validity: string
  price: number
}

export default function BuyDataWorkflow() {
  const router = useRouter()
  const { user } = useUser()
  const { toast } = useToast()

  const [stage, setStage] = useState<'input' | 'confirm' | 'success'>('input')
  const [loading, setLoading] = useState(false)
  const [plansLoading, setPlansLoading] = useState(false)

  const [phoneNumber, setPhoneNumber] = useState('')
  const [selectedNetwork, setSelectedNetwork] = useState(NETWORKS[0])
  const [plans, setPlans] = useState<DataPlan[]>([])
  const [selectedPlan, setSelectedPlan] = useState<DataPlan | null>(null)

  const { data: wallets } = useCollection(user ? { table: 'wallets', userId: user.id, limit: 1 } : null)
  const wallet = wallets?.[0]

  useEffect(() => {
    async function fetchPlans() {
      setPlansLoading(true)
      try {
        const res = await fetch(`/api/data/plans?network=${selectedNetwork}`)
        const data = await res.json()
        setPlans(data)
      } catch (e) {
        console.error('Failed to fetch plans', e)
      } finally {
        setPlansLoading(false)
      }
    }
    fetchPlans()
  }, [selectedNetwork])

  const handleBuyClick = (plan: DataPlan) => {
    if (!phoneNumber || phoneNumber.length < 10) {
      toast({ variant: "destructive", title: "Invalid Number", description: "Please enter a valid phone number." })
      return
    }
    setSelectedPlan(plan)
    setStage('confirm')
  }

  const handlePurchase = async () => {
    if (!user || !wallet || !selectedPlan) return

    if ((wallet.available || 0) < selectedPlan.price) {
      toast({ variant: "destructive", title: "Insufficient Funds", description: "Your wallet balance is too low for this purchase." })
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/data/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, network: selectedNetwork, planId: selectedPlan.id, planTitle: selectedPlan.title, amount: selectedPlan.price })
      })

      const result = await res.json()

      if (result.success) {
        setStage('success')
      } else {
        toast({ variant: "destructive", title: "Purchase Failed", description: result.error || "Could not complete data purchase." })
      }
    } catch (e) {
      console.error('Purchase error', e)
    } finally {
      setLoading(false)
    }
  }

  if (stage === 'input') {
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
            <h1 className="text-[22px] font-bold text-[#1A1A1A]">Data Bundles</h1>
            <p className="text-[14px] text-gray-500">Select a plan to recharge your line.</p>
          </div>
        </header>

        <div className="px-6 py-6">
          <section className="mb-8">
            <h2 className="text-[15px] font-bold text-[#1A1A1A] mb-4">Recipient & Network</h2>
            <Card className="p-6 border-none shadow-soft rounded-[28px] bg-white">
              <div className="relative group mb-6">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                  <Smartphone size={20} />
                </span>
                <Input 
                  placeholder="Recipient Phone Number" 
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                  className="pl-12 h-14 rounded-2xl bg-gray-50 border-none" 
                />
              </div>

              <div className="grid grid-cols-4 gap-2">
                {NETWORKS.map((net) => (
                  <button
                    key={net}
                    onClick={() => setSelectedNetwork(net)}
                    className={cn(
                      "h-12 rounded-xl text-[12px] font-bold transition-all border",
                      selectedNetwork === net ? "bg-primary text-white border-primary" : "bg-white text-gray-500 border-gray-100"
                    )}
                  >
                    {net}
                  </button>
                ))}
              </div>
            </Card>
          </section>

          <section>
            <h2 className="text-[15px] font-bold text-[#1A1A1A] mb-4">Select Plan</h2>
            {plansLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="animate-spin text-primary" size={32} />
                <p className="text-sm text-gray-400">Loading {selectedNetwork} Plans...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {plans.map((plan) => (
                  <Card key={plan.id} className="p-4 border-none shadow-soft rounded-[24px] bg-white flex items-center justify-between">
                    <div>
                      <h4 className="text-[16px] font-bold text-[#1A1A1A] mb-1">{plan.title}</h4>
                      <p className="text-[11px] text-gray-500">Valid for {plan.validity}</p>
                    </div>
                    <button onClick={() => handleBuyClick(plan)} className="px-5 py-2.5 bg-primary text-white font-bold text-[13px] rounded-xl">₦{plan.price}</button>
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

  if (stage === 'confirm') {
    return (
      <main className="min-h-screen pb-32 bg-[#F8FAF9]">
        <header className="px-6 pt-8 pb-4 bg-white sticky top-0 z-30 shadow-sm">
          <div className="flex items-center justify-between">
            <button onClick={() => setStage('input')} className="w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center text-[#1A1A1A] active:scale-90 transition-all border border-gray-100">
              <ChevronLeft size={22} />
            </button>
            <h1 className="text-[18px] font-bold text-[#1A1A1A]">Confirm Purchase</h1>
            <div className="w-10" />
          </div>
        </header>

        <div className="px-6 py-10">
          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-primary/10 rounded-[28px] flex items-center justify-center text-primary mx-auto mb-4">
              <Wifi size={36} />
            </div>
            <div className="text-[32px] font-bold text-[#1A1A1A] mb-1">₦{selectedPlan?.price.toLocaleString()}</div>
            <p className="text-[13px] text-gray-500 font-medium">{selectedNetwork} Data Plan</p>
          </div>

          <Card className="p-6 border-none shadow-soft rounded-[32px] bg-white mb-8">
            <div className="space-y-5">
              <div className="flex justify-between"><span className="text-gray-400">Recipient</span><span className="font-bold">{phoneNumber}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Network</span><span className="font-bold">{selectedNetwork}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Plan</span><span className="font-bold">{selectedPlan?.title}</span></div>
            </div>
          </Card>

          <button 
            disabled={loading}
            onClick={handlePurchase}
            className="w-full py-5 bg-primary text-white font-bold rounded-[22px] shadow-lg flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" /> : <>Complete Purchase <CheckCircle2 size={18} /></>}
          </button>
        </div>
      </main>
    )
  }

  if (stage === 'success') {
    return (
      <main className="min-h-screen flex flex-col bg-white">
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-24 h-24 bg-primary rounded-[32px] flex items-center justify-center text-white shadow-2xl mb-8">
            <CheckCircle2 size={56} />
          </div>
          <h1 className="text-[28px] font-bold text-[#1A1A1A] mb-2">Request Received</h1>
          <p className="text-[15px] text-gray-500 mb-12">Your request is with nexMonie operations. You will receive an update when the service is fulfilled.</p>
          <button onClick={() => router.push('/')} className="w-full py-5 bg-[#1A1A1A] text-white font-bold rounded-[22px]">Return to Dashboard</button>
        </div>
      </main>
    )
  }

  return null
}


"use client"

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  ChevronLeft, 
  Smartphone, 
  CheckCircle2, 
  Loader2, 
  Zap
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NexLogo } from '@/components/ui/NexLogo'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils'
import { useUser, useCollection } from '@/supabase'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'

const QUICK_AMOUNTS = [100, 200, 500, 1000, 2000, 5000]

type Network = {
  id: string
  name: string
  logo: string
}

export default function BuyAirtimeWorkflow() {
  const router = useRouter()
  const { user } = useUser()
  const { toast } = useToast()

  const [stage, setStage] = useState<'input' | 'confirm' | 'success'>('input')
  const [loading, setLoading] = useState(false)
  const [networksLoading, setNetworksLoading] = useState(false)

  const [phoneNumber, setPhoneNumber] = useState('')
  const [networks, setNetworks] = useState<Network[]>([])
  const [selectedNetwork, setSelectedNetwork] = useState<Network | null>(null)
  const [amount, setAmount] = useState('')

  const { data: wallets } = useCollection(user ? { table: 'wallets', userId: user.id, limit: 1 } : null)
  const wallet = wallets?.[0]

  useEffect(() => {
    async function fetchNetworks() {
      setNetworksLoading(true)
      try {
        const res = await fetch('/api/airtime/networks')
        const data = await res.json()
        setNetworks(data)
        if (data.length > 0) setSelectedNetwork(data[0])
      } catch (e) {
        console.error('Failed to fetch networks', e)
      } finally {
        setNetworksLoading(false)
      }
    }
    fetchNetworks()
  }, [])

  const handleContinue = () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      toast({ variant: "destructive", title: "Invalid Number", description: "Please enter a valid phone number." })
      return
    }
    if (!amount || Number(amount) < 50) {
      toast({ variant: "destructive", title: "Invalid Amount", description: "Minimum airtime purchase is ₦50." })
      return
    }
    setStage('confirm')
  }

  const handlePurchase = async () => {
    if (!user || !selectedNetwork) return
    const numericAmount = Number(amount)
    if (!Number.isFinite(numericAmount) || numericAmount < 50) {
      toast({ variant: "destructive", title: "Invalid Amount", description: "Minimum airtime purchase is ₦50." })
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/airtime/purchase', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phoneNumber, network: selectedNetwork.name, amount: numericAmount }) })
      const result = await res.json()
      if (result.success) setStage('success')
      else toast({ variant: "destructive", title: "Request Failed", description: result.error || "Could not create airtime request." })
    } catch {
      toast({ variant: "destructive", title: "Request Failed", description: "Could not reach nexMonie operations." })
    } finally { setLoading(false) }
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
            <h1 className="text-[22px] font-bold text-[#1A1A1A]">Buy Airtime</h1>
            <p className="text-[14px] text-gray-500">Recharge any phone number instantly.</p>
          </div>
        </header>

        <div className="px-6 py-8">
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

              {networksLoading ? (
                <div className="flex justify-center py-4"><Loader2 className="animate-spin text-primary" size={24} /></div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {networks.map((net) => (
                    <button
                      key={net.id}
                      onClick={() => setSelectedNetwork(net)}
                      className={cn(
                        "h-12 rounded-xl text-[12px] font-bold transition-all border",
                        selectedNetwork?.id === net.id 
                          ? "bg-primary text-white border-primary shadow-md" 
                          : "bg-white text-gray-500 border-gray-100"
                      )}
                    >
                      {net.name}
                    </button>
                  ))}
                </div>
              )}
            </Card>
          </section>

          <section className="mb-10">
            <h2 className="text-[15px] font-bold text-[#1A1A1A] mb-4">Select Amount</h2>
            <Card className="p-6 border-none shadow-soft rounded-[28px] bg-white">
              <div className="grid grid-cols-3 gap-2 mb-6">
                {QUICK_AMOUNTS.map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setAmount(amt.toString())}
                    className={cn(
                      "h-12 rounded-xl text-[14px] font-bold transition-all border",
                      amount === amt.toString() ? "bg-primary text-white border-primary" : "bg-white text-gray-500 border-gray-100"
                    )}
                  >
                    ₦{amt}
                  </button>
                ))}
              </div>
              
              <div className="relative group">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[16px] font-bold text-[#1A1A1A]">₦</span>
                <Input 
                  placeholder="Enter Custom Amount" 
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
                  className="pl-10 h-14 rounded-2xl bg-gray-50 border-none font-bold text-[18px]" 
                />
              </div>
            </Card>
          </section>

          <button onClick={handleContinue} className="w-full py-5 bg-primary text-white font-bold rounded-[22px] shadow-lg shadow-primary/20">Continue</button>
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
              <Zap size={36} />
            </div>
            <div className="text-[32px] font-bold text-[#1A1A1A] mb-1">₦{Number(amount).toLocaleString()}</div>
            <p className="text-[13px] text-gray-500 font-medium">{selectedNetwork?.name} Airtime Payment</p>
          </div>

          <Card className="p-6 border-none shadow-soft rounded-[32px] bg-white mb-8">
            <div className="space-y-5">
              <div className="flex justify-between"><span className="text-gray-400">Recipient</span><span className="font-bold">{phoneNumber}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Network</span><span className="font-bold">{selectedNetwork?.name}</span></div>
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
          <p className="text-[15px] text-gray-500 mb-12">₦{Number(amount).toLocaleString()} Airtime sent to {phoneNumber}.</p>
          <button onClick={() => router.push('/')} className="w-full py-5 bg-[#1A1A1A] text-white font-bold rounded-[22px]">Return to Dashboard</button>
        </div>
      </main>
    )
  }

  return null
}

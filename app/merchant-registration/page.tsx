"use client"

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  ChevronLeft, 
  CheckCircle2, 
  ShieldCheck, 
  Store, 
  ArrowRight, 
  Loader2, 
  Building2,
  Lock,
  Smartphone,
  Award,
  Zap,
  Mail,
  FileUp,
  AlertCircle,
  Clock
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NexLogo } from '@/components/ui/NexLogo'
import { useUser } from '@/supabase'
import { merchantService, MERCHANT_TIERS } from '@/services/merchantService'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { type MerchantTierId } from '@/types'

type Step = 'intro' | 'eligibility' | 'tier-select' | 'uploads' | 'review' | 'result'

export default function MerchantRegistration() {
  const router = useRouter()
  const { user } = useUser()
  const { toast } = useToast()

  const [activeStep, setActiveStep] = useState<Step>('intro')
  const [loading, setLoading] = useState(false)
  const [selectedTier, setSelectedTier] = useState<MerchantTierId>('Beginner')
  const [nickname, setNickname] = useState('')

  const handleNext = () => {
    const steps: Step[] = ['intro', 'eligibility', 'tier-select', 'uploads', 'review', 'result']
    const nextIndex = steps.indexOf(activeStep) + 1
    if (nextIndex < steps.length) {
      // Logic: Skip uploads for Beginner/Regular
      if (activeStep === 'tier-select' && (selectedTier === 'Beginner' || selectedTier === 'Regular')) {
        setActiveStep('review')
      } else {
        setActiveStep(steps[nextIndex])
      }
      window.scrollTo(0, 0)
    }
  }

  const handleBack = () => {
    if (activeStep === 'intro') {
      router.back()
      return
    }
    const steps: Step[] = ['intro', 'eligibility', 'tier-select', 'uploads', 'review', 'result']
    const prevIndex = steps.indexOf(activeStep) - 1
    setActiveStep(steps[prevIndex])
  }

  const handleSubmit = async () => {
    if (!user) return
    setLoading(true)
    try {
      await merchantService.submitApplication(user.id, {
        nickname,
        tier: selectedTier,
        kycLevel: 2
      })

      setActiveStep('result')
    } catch (e) {
      toast({ variant: 'destructive', title: 'Submission Failed', description: 'Could not create application.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen pb-32 bg-[#F8FAF9]">
      <header className="px-6 pt-10 pb-6 bg-white sticky top-0 z-30 shadow-sm">
        <div className="flex items-center justify-between">
          <button onClick={handleBack} className="w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center text-[#1A1A1A] border border-gray-100 active:scale-90 transition-all">
            <ChevronLeft size={22} />
          </button>
          <h1 className="text-[18px] font-bold text-[#1A1A1A]">Merchant Hub</h1>
          <div className="w-10" />
        </div>
      </header>

      <div className="px-6 py-8">
        {activeStep === 'intro' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col items-center text-center mb-10">
              <div className="w-24 h-24 bg-primary/5 rounded-[40px] flex items-center justify-center text-primary mb-6 shadow-inner border border-primary/10">
                <Store size={48} />
              </div>
              <h2 className="text-[26px] font-bold text-[#1A1A1A] leading-tight mb-3">Elite P2P Merchant</h2>
              <p className="text-[15px] text-gray-500 font-medium px-4">
                Join the circle of liquidity providers. Follow Bybit-grade standards to trade with trust.
              </p>
            </div>

            <div className="space-y-4 mb-10">
              <BenefitItem icon={<Zap />} title="Zero Fee Trading" desc="Pay 0% commission on all your P2P advertisements." />
              <BenefitItem icon={<Award />} title="Metal Tier Badges" desc="Unlock Bronze, Silver, and Gold badges based on your performance." />
              <BenefitItem icon={<Smartphone size={20} />} title="Global Liquidity" desc="Access the deepest P2P order book in the Nigerian market." />
            </div>

            <button onClick={handleNext} className="w-full py-5 bg-primary text-white font-bold rounded-[22px] shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-3">
              Apply Now <ArrowRight size={20} />
            </button>
          </div>
        )}

        {activeStep === 'eligibility' && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500">
            <h2 className="text-[22px] font-bold text-[#1A1A1A] mb-2">Requirements</h2>
            <p className="text-[14px] text-gray-500 mb-8">Confirm your eligibility for Beginner Tier.</p>

            <Card className="p-6 border-none shadow-nex-soft rounded-[32px] bg-white space-y-6 mb-10">
              <RequirementCheck label="Standard KYC Verified" status="verified" icon={<ShieldCheck />} />
              <RequirementCheck label="Email & Phone Linked" status="verified" icon={<Smartphone />} />
              <RequirementCheck label="Reg. Age ≥ 7 Days" status="verified" icon={<Clock />} />
              <RequirementCheck label="Security Deposit Ready" status="pending" icon={<Zap />} />
            </Card>

            <div className="space-y-4 mb-10">
               <label className="text-nex-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Merchant Nickname</label>
               <Input 
                 placeholder="e.g. EliteTrader_PRO" 
                 value={nickname}
                 onChange={(e) => setNickname(e.target.value)}
                 className="h-14 rounded-2xl bg-white border-gray-100 font-bold" 
               />
            </div>

            <button 
              disabled={!nickname}
              onClick={handleNext} 
              className="w-full py-5 bg-primary text-white font-bold rounded-[22px] shadow-lg disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        )}

        {activeStep === 'tier-select' && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500">
            <h2 className="text-[22px] font-bold text-[#1A1A1A] mb-2">Select Tier</h2>
            <p className="text-[14px] text-gray-500 mb-8">Higher tiers require document verification.</p>

            <div className="space-y-3 mb-10">
              {(Object.keys(MERCHANT_TIERS) as MerchantTierId[]).map((tierId) => {
                const tier = MERCHANT_TIERS[tierId]
                const isActive = selectedTier === tierId
                return (
                  <Card 
                    key={tierId} 
                    onClick={() => setSelectedTier(tierId)}
                    className={cn(
                      "p-5 border-2 rounded-[28px] cursor-pointer transition-all",
                      isActive ? "border-primary bg-primary/5 shadow-md" : "border-gray-50 bg-white"
                    )}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", isActive ? "bg-primary text-white" : "bg-gray-50 text-gray-400")}>
                           <Award size={20} />
                        </div>
                        <div>
                          <h4 className="text-[15px] font-bold text-[#1A1A1A]">{tier.label}</h4>
                          <p className="text-[11px] text-gray-400 font-medium">Deposit: {tier.securityDeposit} USDT</p>
                        </div>
                      </div>
                      {isActive && <CheckCircle2 size={20} className="text-primary" />}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                       {tier.permissions.map((p, i) => (
                         <Badge key={i} variant="outline" className="bg-white text-[9px] font-bold text-gray-500 border-gray-100">{p}</Badge>
                       ))}
                    </div>
                  </Card>
                )
              })}
            </div>

            <button onClick={handleNext} className="w-full py-5 bg-primary text-white font-bold rounded-[22px] shadow-lg">Next Step</button>
          </div>
        )}

        {activeStep === 'uploads' && (
          <div className="animate-in slide-in-from-right-4 duration-500">
             <h2 className="text-[22px] font-bold text-[#1A1A1A] mb-2">Verification Proof</h2>
             <p className="text-[14px] text-gray-500 mb-8">Required for Verified & Block tiers.</p>
             
             <div className="space-y-6 mb-10">
                <UploadCard title="Bank Statement" sub="Last 90 days history (PDF)" />
                <UploadCard title="Source of Funds" sub="Proof of legitimate income" />
                <UploadCard title="External P2P Profile" sub="Binance/Bybit account proof" />
             </div>

             <button onClick={handleNext} className="w-full py-5 bg-primary text-white font-bold rounded-[22px] shadow-lg">Review & Submit</button>
          </div>
        )}

        {activeStep === 'review' && (
          <div className="animate-in slide-in-from-right-4 duration-500">
             <h2 className="text-[22px] font-bold text-[#1A1A1A] mb-6">Application Summary</h2>
             
             <Card className="p-8 border-none shadow-nex-soft rounded-[32px] bg-white space-y-6 mb-10">
                <div className="flex justify-between items-center"><span className="text-gray-400 text-[13px]">Nickname</span><span className="font-bold">{nickname}</span></div>
                <div className="flex justify-between items-center"><span className="text-gray-400 text-[13px]">Target Tier</span><span className="font-bold text-primary">{MERCHANT_TIERS[selectedTier].label}</span></div>
                <div className="flex justify-between items-center"><span className="text-gray-400 text-[13px]">Security Deposit</span><span className="font-bold text-accent">{MERCHANT_TIERS[selectedTier].securityDeposit} USDT</span></div>
                <div className="flex justify-between items-center"><span className="text-gray-400 text-[13px]">Ad Limit</span><span className="font-bold">{MERCHANT_TIERS[selectedTier].maxAdLimit.toLocaleString()} USDT</span></div>
             </Card>

             <div className="bg-blue-50 p-5 rounded-[24px] border border-blue-100 flex gap-4 mb-10">
                <AlertCircle size={20} className="text-blue-500 shrink-0 mt-0.5" />
                <p className="text-[12px] text-blue-700 leading-relaxed font-medium">
                  Your security deposit will be frozen upon approval. You can withdraw the deposit anytime by closing your merchant account.
                </p>
             </div>

             <button 
              disabled={loading}
              onClick={handleSubmit} 
              className="w-full py-5 bg-primary text-white font-bold rounded-[22px] shadow-xl flex items-center justify-center gap-2"
             >
               {loading ? <Loader2 className="animate-spin" /> : <>Submit Application <CheckCircle2 size={18} /></>}
             </button>
          </div>
        )}

        {activeStep === 'result' && (
          <div className="animate-in zoom-in-95 duration-500 flex flex-col items-center text-center py-10">
            <div className="w-24 h-24 bg-emerald-500 rounded-[40px] flex items-center justify-center text-white mb-8 shadow-2xl">
              <CheckCircle2 size={56} />
            </div>
            <h2 className="text-[28px] font-bold text-[#1A1A1A] mb-2">Success!</h2>
            <p className="text-[15px] text-gray-500 font-medium px-8 leading-relaxed mb-12">
              Your application is <span className="text-amber-600 font-bold">Pending review</span>. You will receive a notification when a decision is made.
            </p>
            <button onClick={() => router.push('/')} className="w-full py-5 bg-[#1A1A1A] text-white font-bold rounded-[22px]">Return Home</button>
          </div>
        )}
      </div>
    </main>
  )
}

function BenefitItem({ icon, title, desc }: any) {
  return (
    <div className="flex gap-4 p-5 bg-white rounded-[24px] border border-gray-50 shadow-sm">
      <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary shrink-0">
        {icon}
      </div>
      <div>
        <h4 className="font-bold text-[#1A1A1A] text-[15px] mb-0.5">{title}</h4>
        <p className="text-[12px] text-gray-500 font-medium leading-tight">{desc}</p>
      </div>
    </div>
  )
}

function RequirementCheck({ label, status, icon }: any) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400">{icon}</div>
        <span className="text-[14px] font-bold text-[#1A1A1A]">{label}</span>
      </div>
      {status === 'verified' ? (
        <CheckCircle2 size={20} className="text-emerald-500" />
      ) : (
        <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-100 text-[10px] font-black uppercase">Required</Badge>
      )}
    </div>
  )
}

function UploadCard({ title, sub }: any) {
  return (
    <div className="p-5 border-2 border-dashed border-gray-100 rounded-[24px] bg-white flex flex-col items-center text-center gap-2 group hover:border-primary transition-colors">
       <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-primary/5 group-hover:text-primary transition-colors">
          <FileUp size={24} />
       </div>
       <div>
          <h4 className="text-[14px] font-bold text-[#1A1A1A]">{title}</h4>
          <p className="text-[11px] text-gray-400 font-medium">{sub}</p>
       </div>
    </div>
  )
}

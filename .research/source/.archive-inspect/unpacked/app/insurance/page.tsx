'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, ChevronLeft, ExternalLink, ShieldCheck } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { BottomNav } from '@/components/layout/BottomNav'

const PROVIDERS = [
  { name: 'AXA Mansard', detail: 'Health, life, motor and travel cover', href: 'https://www.axamansard.com' },
  { name: 'AIICO Insurance', detail: 'Life, health, motor and travel products', href: 'https://www.aiicoplc.com' },
  { name: 'Leadway Assurance', detail: 'Life, auto, education and mortgage protection', href: 'https://www.leadway.com' },
]

export default function InsurancePage() {
  const router = useRouter()
  const [selected, setSelected] = useState<(typeof PROVIDERS)[number] | null>(null)
  const [plan, setPlan] = useState('')

  return (
    <main className="min-h-screen pb-32 bg-[#F8FAF9]">
      <header className="px-6 pt-8 pb-4 bg-white sticky top-0 z-30 shadow-sm"><div className="flex items-center justify-between"><button onClick={() => router.back()} className="w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center border border-gray-100"><ChevronLeft size={22} /></button><h1 className="text-[18px] font-bold text-[#1A1A1A]">Insurance</h1><div className="w-10" /></div></header>
      <div className="px-6 py-6 space-y-5">
        {!selected ? <><div className="flex items-center gap-3 mb-2"><div className="w-12 h-12 rounded-2xl bg-[#F3EEFF] flex items-center justify-center text-[#7C3AED]"><ShieldCheck size={25} /></div><div><h2 className="font-bold text-[#1A1A1A]">Choose protection</h2><p className="text-[12px] text-gray-500">Select an insurer and product to explore.</p></div></div>{PROVIDERS.map((provider) => <button key={provider.name} onClick={() => setSelected(provider)} className="w-full text-left"><Card className="p-5 rounded-[24px] border-none shadow-soft bg-white flex items-center gap-4 active:scale-[0.98]"><div className="w-11 h-11 rounded-2xl bg-gray-50 flex items-center justify-center font-black text-primary">{provider.name[0]}</div><div className="flex-1"><h3 className="font-bold text-[#1A1A1A] text-[14px]">{provider.name}</h3><p className="text-[11px] text-gray-500 mt-1">{provider.detail}</p></div><ArrowRight size={17} className="text-gray-300" /></Card></button>)}<p className="text-[10px] text-gray-400 leading-relaxed">Products, eligibility and premiums are set by each insurer. NexMonie does not issue policies.</p></> : <><button onClick={() => setSelected(null)} className="text-[12px] font-bold text-primary">Change provider</button><Card className="p-6 rounded-[28px] border-none shadow-soft bg-white"><p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Selected insurer</p><h2 className="text-[22px] font-bold text-[#1A1A1A] mt-2">{selected.name}</h2><p className="text-[12px] text-gray-500 mt-1">{selected.detail}</p><label className="block text-[11px] font-bold text-gray-500 mt-7 mb-2">What do you want to protect?</label><select value={plan} onChange={(event) => setPlan(event.target.value)} className="w-full h-12 rounded-2xl bg-gray-50 border border-gray-100 px-4 text-[13px] font-bold outline-none"><option value="">Select a product</option><option>Health cover</option><option>Life cover</option><option>Motor cover</option><option>Travel cover</option></select><a href={selected.href} target="_blank" rel="noreferrer" className="mt-5 h-12 bg-primary text-white font-bold rounded-2xl flex items-center justify-center gap-2 text-[13px]">Continue with {selected.name}<ExternalLink size={15} /></a></Card><p className="text-[10px] text-gray-400 leading-relaxed">Continue to the insurer&apos;s own quote and customer-details flow. No policy purchase is simulated.</p></>}
      </div><BottomNav />
    </main>
  )
}

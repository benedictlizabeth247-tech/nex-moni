"use client"
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Rocket, Search, ShieldCheck, Users } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { BottomNav } from '@/components/layout/BottomNav'

const PROJECTS = [
 {id:'launch-1',name:'NexChain',symbol:'NXC',stage:'Upcoming',description:'Early access to the NexChain ecosystem.',allocation:'Community allocation',status:'Open soon'},
 {id:'launch-2',name:'NexPay Network',symbol:'NPN',stage:'Live',description:'Infrastructure for programmable payments.',allocation:'Public participation',status:'Participation available'},
 {id:'launch-3',name:'NexAI',symbol:'NXAI',stage:'Upcoming',description:'AI infrastructure for autonomous financial experiences.',allocation:'Launch allocation',status:'Open soon'},
]

export default function InvestmentsPage(){
 const router=useRouter()
 return <main className="min-h-screen bg-[#F8FAF9] pb-32"><header className="sticky top-0 z-30 bg-white/95 px-4 py-4 backdrop-blur border-b border-gray-100"><div className="flex items-center justify-between"><button onClick={()=>router.back()} className="h-10 w-10 rounded-2xl bg-gray-50 flex items-center justify-center"><ArrowLeft size={18}/></button><h1 className="text-[18px] font-black">Launchpad</h1><div className="w-10"/></div><div className="mt-4 relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/><input placeholder="Search launches, assets..." className="h-11 w-full rounded-2xl bg-gray-50 pl-9 pr-4 text-[12px] outline-none"/></div></header><div className="px-4 py-5 space-y-4"><Card className="rounded-[26px] border-none bg-primary p-5 text-white shadow-sm"><Rocket size={22}/><h2 className="mt-4 text-[22px] font-black">Launchpad</h2><p className="mt-1 text-[11px] leading-relaxed text-white/75">Discover launches, review terms, check eligibility and participate when the connected allocation rail is available.</p></Card>{PROJECTS.map(p=><Card key={p.id} className="rounded-[24px] border-none bg-white p-5 shadow-sm"><div className="flex items-start gap-3"><div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center font-black text-primary">{p.symbol.slice(0,1)}</div><div className="flex-1"><div className="flex justify-between gap-3"><div><h3 className="text-[14px] font-black">{p.name}</h3><p className="mt-1 text-[10px] text-gray-400">{p.symbol} · {p.stage}</p></div><span className="rounded-full bg-gray-50 px-2 py-1 text-[9px] font-bold text-gray-500">{p.status}</span></div><p className="mt-3 text-[11px] leading-relaxed text-gray-500">{p.description}</p><div className="mt-4 flex items-center gap-4 text-[10px] text-gray-500"><span className="flex items-center gap-1"><Users size={12}/> {p.allocation}</span><span className="flex items-center gap-1"><ShieldCheck size={12}/> Verified terms</span></div><button onClick={()=>router.push(`/markets/${encodeURIComponent('crypto.'+p.symbol+'USDT')}`)} className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-gray-900 text-white text-[11px] font-bold">View asset market <ArrowRight size={14}/></button></div></div></Card>)}</div><BottomNav/></main>
}

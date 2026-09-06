"use client"

import React from 'react'
import { useRouter } from 'next/navigation'
import { BottomNav } from '@/components/layout/BottomNav'
import { NexLogo } from '@/components/ui/NexLogo'
import { cn } from '@/lib/utils'
import { InviteDialog } from '@/components/dashboard/InviteDialog'
import { ArrowLeft, Bell, User, Send, Download, QrCode, FileText, Smartphone, Wifi, Zap, Coins, Lock, Umbrella, UserPlus, Repeat, Headset, Settings, CreditCard, CandlestickChart, ArrowDownUp, Bot, Rocket, GraduationCap, ShieldCheck } from 'lucide-react'

type Service = { title:string; subtitle:string; icon:React.ReactNode; href?:string; tone?:'green'|'neutral' }

const services: Service[] = [
  {title:'Send Money',subtitle:'Send instantly',icon:<Send/>,href:'/send-money'},
  {title:'Receive',subtitle:'Your receive details',icon:<Download/>,href:'/wallet-details'},
  {title:'Scan & Pay',subtitle:'Scan a QR code',icon:<QrCode/>,href:'/scan-pay'},
  {title:'Request Money',subtitle:'Request from anyone',icon:<ArrowDownUp/>,href:'/request-money'},
  {title:'Pay Bills',subtitle:'Electricity, TV & more',icon:<FileText/>,href:'/pay-bills'},
  {title:'Airtime',subtitle:'Recharge any network',icon:<Smartphone/>,href:'/buy-airtime'},
  {title:'Data',subtitle:'Buy data bundles',icon:<Wifi/>,href:'/buy-data'},
  {title:'Electricity',subtitle:'Pay power bills',icon:<Zap/>,href:'/pay-bills'},
  {title:'Spot Trading',subtitle:'Trade supported pairs',icon:<CandlestickChart/>,href:'/spot'},
  {title:'Futures',subtitle:'Long & short markets',icon:<CreditCard/>,href:'/futures'},
  {title:'Convert',subtitle:'Swap supported assets',icon:<ArrowDownUp/>,href:'/spot'},
  {title:'NexPilot',subtitle:'Automated portfolios',icon:<Bot/>,href:'/finances'},
  {title:'Launchpad',subtitle:'Explore new assets',icon:<Rocket/>,href:'/markets'},
  {title:'Learn & Earn',subtitle:'Learn market basics',icon:<GraduationCap/>,href:'/earn'},
  {title:'Investments',subtitle:'Grow your portfolio',icon:<Coins/>,href:'/investments'},
  {title:'Savings',subtitle:'Save with purpose',icon:<ShieldCheck/>,href:'/save'},
  {title:'NexVault',subtitle:'Secure your funds',icon:<Lock/>,href:'/nexvault'},
  {title:'Insurance',subtitle:'Protect your assets',icon:<Umbrella/>,href:'/insurance'},
  {title:'Transactions',subtitle:'Review activity',icon:<Repeat/>,href:'/transactions'},
  {title:'Support',subtitle:'Get help',icon:<Headset/>,href:'/support'},
]

export default function ActionsHub(){
 const router=useRouter()
 const groups=[['Move money',services.slice(0,4)],['Bills & recharge',services.slice(4,8)],['Trade & markets',services.slice(8,14)],['Grow & protect',services.slice(14,18)],['Account',services.slice(18)]] as const
 return <main className="min-h-screen bg-[#EEF2F1] pb-32 text-[#16231F] dark:bg-[#0F1715] dark:text-[#EAF3F0]">
   <header className="sticky top-0 z-30 border-b border-[#DDE5E1] bg-[#F3F6F4]/95 px-4 py-3 backdrop-blur-xl dark:border-[#293832] dark:bg-[#0F1715]/95">
    <div className="flex items-center justify-between">
      <button onClick={()=>router.push('/')} className="grid h-10 w-10 place-items-center rounded-2xl border border-[#D9E2DE] bg-white text-[#25352F] active:scale-95 dark:border-[#2B3B35] dark:bg-[#17231F] dark:text-[#EAF3F0]"><ArrowLeft size={19}/></button>
      <div className="text-center"><NexLogo/><p className="mt-0.5 text-[9px] font-medium text-[#75837E]">Services</p></div>
      <button onClick={()=>router.push('/notifications')} className="relative grid h-10 w-10 place-items-center rounded-2xl border border-[#D9E2DE] bg-white dark:border-[#2B3B35] dark:bg-[#17231F]"><Bell size={18}/><span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#16A36A]"/></button>
    </div>
   </header>
   <div className="mx-auto w-full max-w-xl px-4 pt-5">
    <section className="mb-6 rounded-[24px] border border-[#DCE6E1] bg-white p-5 shadow-[0_12px_35px_rgba(25,55,45,.07)] dark:border-[#2A3A35] dark:bg-[#17231F]">
      <div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#087F5B]">All services</p><h1 className="mt-1 text-[22px] font-black tracking-[-.03em]">Everything in one place</h1><p className="mt-1 text-[11px] leading-5 text-[#71807A] dark:text-[#9BAAA4]">Move money, pay bills, trade, invest and manage your account.</p></div><div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#E8F7F0] text-[#087F5B] dark:bg-[#20362E]"><NexLogo iconOnly className="h-8 w-8"/></div></div>
    </section>
    {groups.map(([name,items])=><section key={name} className="mb-5"><h2 className="mb-3 px-1 text-[13px] font-black tracking-[-.01em]">{name}</h2><div className="grid grid-cols-2 gap-2.5">{items.map(s=><ServiceTile key={s.title} service={s} onClick={()=>s.href&&router.push(s.href)}/>)}</div></section>)}
    <section className="mb-5"><h2 className="mb-3 px-1 text-[13px] font-black">More</h2><div className="grid grid-cols-2 gap-2.5"><InviteDialog trigger={<button className="rounded-[22px] border border-[#DCE6E1] bg-white p-3.5 text-left shadow-[0_6px_20px_rgba(25,55,45,.045)] dark:border-[#2A3A35] dark:bg-[#17231F]"><IconBox icon={<UserPlus/>}/><b className="mt-3 block text-[12px]">Refer & Earn</b><span className="mt-1 block text-[10px] text-[#71807A]">Invite friends</span></button>}/><ServiceTile service={{title:'Settings',subtitle:'Manage your account',icon:<Settings/>,href:'/profile'}} onClick={()=>router.push('/profile')}/></div></section>
   </div><BottomNav/>
 </main>
}
function IconBox({icon}:{icon:React.ReactNode}){return <div className="grid h-9 w-9 place-items-center rounded-[13px] bg-[#E8F7F0] text-[#087F5B] dark:bg-[#20362E] dark:text-[#5BD19D]">{React.isValidElement(icon)?React.cloneElement(icon as React.ReactElement,{size:19,strokeWidth:2.1}):icon}</div>}
function ServiceTile({service,onClick}:{service:Service;onClick:()=>void}){return <button onClick={onClick} className="group min-h-[102px] rounded-[19px] border border-[#DCE6E1] bg-white p-3.5 text-left shadow-[0_6px_20px_rgba(25,55,45,.045)] transition active:scale-[.985] dark:border-[#2A3A35] dark:bg-[#17231F]"><IconBox icon={service.icon}/><div className="mt-2.5 flex items-end justify-between gap-2"><div><b className="block text-[11px] font-black leading-4">{service.title}</b><span className="mt-1 block text-[10px] leading-4 text-[#71807A] dark:text-[#9BAAA4]">{service.subtitle}</span></div><span className="text-[#A1AEA9] transition group-hover:translate-x-0.5">›</span></div></button>}

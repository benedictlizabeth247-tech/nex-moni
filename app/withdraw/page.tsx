"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ArrowUpFromLine, CheckCircle2, ChevronRight, Loader2, ShieldCheck, Building2, CreditCard, Smartphone, Coins, Bot } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { BottomNav } from "@/components/layout/BottomNav"
import { getWallet, type Wallet as WalletType } from "@/services/walletService"
import { createWithdrawalRequest, type WithdrawalDestination } from "@/services/withdrawal"
import { useToast } from "@/hooks/use-toast"

const money=(n:number)=>`${Number(n||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:8})} USDT`

export default function WithdrawPage(){
 const router=useRouter(); const {toast}=useToast()
 const [wallet,setWallet]=useState<WalletType|null>(null); const [amount,setAmount]=useState("")
 const [destinationType,setDestinationType]=useState<WithdrawalDestination>("bank")
 const [autopilot,setAutopilot]=useState(false)
 const rails=[{id:'bank' as const,label:'Bank account',hint:'Configured payout destination',icon:Building2},{id:'nex' as const,label:'Apedat account',hint:'Internal transfer',icon:ArrowUpFromLine},{id:'card_refund' as const,label:'Card refund',hint:'Return to eligible card',icon:CreditCard},{id:'mobile_money' as const,label:'Mobile money',hint:'Supported regional rail',icon:Smartphone},{id:'crypto' as const,label:'Crypto wallet',hint:'Network-specific payout',icon:Coins}]
 const [destination,setDestination]=useState(""); const [busy,setBusy]=useState(false)
 const [submitted,setSubmitted]=useState(false); const [error,setError]=useState("")
 useEffect(()=>{void getWallet().then(setWallet)},[])
 const submit=async()=>{
  setError(""); const n=Number(amount); const available=Number(wallet?.available||0)
  if(!n||n<=0){setError("Enter a valid amount.");return}
  if(n>available){setError("Insufficient available balance.");return}
  if(!destination.trim()){setError(destinationType==='bank'?"Enter the bank account destination.":"Enter the Apedat recipient.");return}
  setBusy(true)
  try{
   const result=await createWithdrawalRequest({amount:n,destinationType,destination,currency:"USDT", autopilot})
   setSubmitted(true)
   toast({title:"Withdrawal request submitted",description:`Reference ${result.reference}`})
  }catch(e:any){setError(e?.message||"Unable to submit withdrawal request.")}
  finally{setBusy(false)}
 }
 return <main className="min-h-screen bg-[#EEF2F1] pb-32 text-[#183A36]">
  <header className="sticky top-0 z-30 border-b border-[#D6E1DE] bg-[#EEF2F1]/95 p-4 backdrop-blur"><button onClick={()=>router.back()} className="h-10 w-10 rounded-xl bg-white border border-[#D6E1DE] flex items-center justify-center"><ArrowLeft size={18}/></button><h1 className="mt-4 text-[22px] font-black">Withdraw</h1><p className="text-[10px] text-[#708A85]">Create a withdrawal request from your Apedat balance.</p></header>
  <div className="space-y-4 p-4">
   <Card className="rounded-[26px] border-none bg-[#183A36] p-5 text-white"><p className="text-[9px] uppercase tracking-widest text-white/60">Available Funding Balance</p><p className="mt-2 text-[28px] font-black">{money(Number(wallet?.available||0))}</p></Card>
   {!submitted?<>
    <Card className="rounded-[26px] border-[#D6E1DE] bg-white p-4 shadow-none">
     <p className="text-[9px] font-black uppercase tracking-widest text-[#708A85]">Withdraw to</p>
     <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
      {rails.map(({id,label,hint,icon:Icon})=><button key={id} onClick={()=>setDestinationType(id)} className={`rounded-xl border p-3 text-left transition-colors ${destinationType===id?"border-[#087F5B] bg-[#E8F7F0]":"border-[#D6E1DE] bg-white"}`}><Icon size={16} className="mb-2 text-[#087F5B]"/><p className="text-[10px] font-black">{label}</p><p className="mt-1 text-[8px] text-[#708A85]">{hint}</p></button>)}
     </div>
     <button type="button" onClick={()=>setAutopilot(!autopilot)} className={`mt-3 flex w-full items-center justify-between rounded-xl border p-3 text-left ${autopilot?"border-[#087F5B] bg-[#E8F7F0]":"border-[#D6E1DE] bg-white"}`}><span className="flex items-center gap-2"><Bot size={16} className="text-[#087F5B]"/><span><b className="block text-[10px]">Autopilot routing</b><small className="text-[8px] text-[#708A85]">Queue eligible payouts after required security checks</small></span></span><span className={`h-5 w-9 rounded-full p-0.5 ${autopilot?"bg-[#087F5B]":"bg-[#B8C6C2]"}`}><span className={`block h-4 w-4 rounded-full bg-white transition-transform ${autopilot?"translate-x-4":""}`}/></span></button>
     <label className="mt-4 block text-[9px] font-black uppercase tracking-widest text-[#708A85]">Destination</label>
     <Input value={destination} onChange={e=>setDestination(e.target.value)} placeholder={destinationType==='bank'?"Bank account number / configured destination":"Recipient nex ID / username"} className="mt-2 h-12 rounded-xl"/>
     <label className="mt-4 block text-[9px] font-black uppercase tracking-widest text-[#708A85]">Amount</label>
     <Input value={amount} onChange={e=>setAmount(e.target.value.replace(/[^0-9.]/g,""))} inputMode="decimal" placeholder="0.00" className="mt-2 h-12 rounded-xl"/>
     <button onClick={()=>setAmount(String(wallet?.available||0))} className="mt-2 text-[9px] font-black text-[#087F5B]">Use maximum available</button>
     {error&&<p className="mt-3 rounded-xl bg-red-50 p-3 text-[9px] font-bold text-red-600">{error}</p>}
    </Card>
    <Card className="rounded-[24px] border-[#D6E1DE] bg-white p-4 shadow-none"><div className="flex gap-3"><ShieldCheck size={18} className="text-[#087F5B] shrink-0"/><p className="text-[9px] leading-5 text-[#708A85]">The request is recorded first. No client-side balance deduction occurs; final balance mutation must happen only when the configured payout rail confirms the withdrawal.</p></div></Card>
    <button disabled={busy} onClick={submit} className="w-full rounded-2xl bg-[#087F5B] py-4 text-[11px] font-black text-white flex items-center justify-center gap-2">{busy?<Loader2 className="animate-spin" size={17}/>:<><ArrowUpFromLine size={16}/> Submit withdrawal request</>}</button>
   </>:<Card className="rounded-[28px] border-none bg-white p-7 text-center shadow-none"><CheckCircle2 size={50} className="mx-auto text-[#16A36A]"/><h2 className="mt-4 text-[20px] font-black">Request submitted</h2><p className="mt-2 text-[10px] leading-5 text-[#708A85]">Your withdrawal request is now in the operational queue. Funds remain protected until the payout rail confirms processing.</p><button onClick={()=>router.push("/transactions")} className="mt-5 w-full rounded-xl bg-[#183A36] py-3 text-[10px] font-black text-white">View activity <ChevronRight size={14} className="inline"/></button></Card>}
  </div><BottomNav/>
 </main>
}

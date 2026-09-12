"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowDownUp, ArrowLeft, CheckCircle2, ChevronDown, LineChart, LoaderCircle, Wallet } from "lucide-react"
import { Card } from "@/components/ui/card"
import { BottomNav } from "@/components/layout/BottomNav"
import { getTradingAccount, transferBetweenAccounts, type TradingAccount, type TradingAccountBucket } from "@/services/internalTradingService"
import { getWallet } from "@/services/walletService"
import type { Wallet as WalletType } from "@/types/database"

const buckets: TradingAccountBucket[] = ["funding", "spot", "futures"]
const formatUsdt = (n: number) => `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })} USDT`

export default function AssetsPage() {
  const router = useRouter()
  const [account, setAccount] = useState<TradingAccount | null>(null)
  const [, setWallet] = useState<WalletType | null>(null)
  const [amount, setAmount] = useState("")
  const [from, setFrom] = useState<TradingAccountBucket>("funding")
  const [to, setTo] = useState<TradingAccountBucket>("spot")
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)

  const load = async () => {
    try {
      const [nextAccount, nextWallet] = await Promise.all([getTradingAccount(), getWallet()])
      setAccount(nextAccount)
      setWallet(nextWallet)
    } catch {
      setMessage("Unable to load balances. Please refresh and try again.")
    }
  }

  useEffect(() => { void load() }, [])

  const balance = (bucket: TradingAccountBucket) => bucket === "funding" ? Number(account?.funding_balance || 0) : bucket === "spot" ? Number(account?.spot_balance || 0) : Number(account?.futures_balance || 0)
  const transfer = async () => {
    const numericAmount = Number(amount)
    setMessage("")
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return setMessage("Enter an amount greater than 0.")
    if (from === to) return setMessage("Choose two different accounts.")
    if (numericAmount > balance(from)) return setMessage(`Available in ${from}: ${formatUsdt(balance(from))}.`)
    setBusy(true)
    try { await transferBetweenAccounts(from, to, numericAmount); setAmount(""); setMessage("Transfer completed successfully."); await load() } catch (error) { setMessage(error instanceof Error ? error.message : "We could not complete the transfer.") } finally { setBusy(false) }
  }

  return <main className="min-h-screen overflow-x-hidden bg-background pb-32 text-foreground">
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/95 p-4 backdrop-blur">
      <button aria-label="Go back" onClick={() => router.back()} className="grid size-10 place-items-center rounded-xl border border-border bg-card shadow-sm"><ArrowLeft size={18} /></button>
      <h1 className="mt-4 text-2xl font-black tracking-tight">Assets</h1>
      <p className="text-xs text-muted-foreground">Overview, funding, spot and futures accounts</p>
    </header>
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <Card className="rounded-3xl border-0 bg-primary p-5 text-primary-foreground shadow-sm"><p className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-70">Total account value</p><p className="mt-2 text-3xl font-black">{formatUsdt(buckets.reduce((sum, bucket) => sum + balance(bucket), 0))}</p><p className="mt-1 text-xs opacity-70">Live USDT account balances</p></Card>
      <div className="grid grid-cols-3 gap-2">{buckets.map(bucket => <Card key={bucket} className="rounded-2xl border-border/70 bg-card p-3"><p className="text-[10px] capitalize text-muted-foreground">{bucket}</p><p className="mt-1 break-words text-sm font-black">{formatUsdt(balance(bucket))}</p></Card>)}</div>
      <Card className="rounded-3xl border-border/70 bg-card/95 p-4 shadow-sm">
        <div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary"><ArrowDownUp size={20} /></div><div><h2 className="font-black">Transfer between accounts</h2><p className="text-xs text-muted-foreground">Move USDT instantly between your trading wallets.</p></div></div>
        <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-end gap-2"><label className="min-w-0 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">From<select value={from} onChange={e => setFrom(e.target.value as TradingAccountBucket)} className="mt-1 h-12 w-full rounded-2xl border border-border bg-background px-3 text-sm font-bold text-foreground outline-none">{buckets.map(bucket => <option key={bucket}>{bucket}</option>)}</select></label><button aria-label="Swap accounts" onClick={() => { setFrom(to); setTo(from) }} className="mb-2 grid size-9 place-items-center rounded-full border border-border bg-background text-muted-foreground"><ArrowDownUp size={15} /></button><label className="min-w-0 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">To<select value={to} onChange={e => setTo(e.target.value as TradingAccountBucket)} className="mt-1 h-12 w-full rounded-2xl border border-border bg-background px-3 text-sm font-bold text-foreground outline-none">{buckets.map(bucket => <option key={bucket}>{bucket}</option>)}</select></label></div>
        <div className="mt-4 flex items-center justify-between text-xs"><span className="text-muted-foreground">Available from {from}</span><button onClick={() => setAmount(String(balance(from)))} className="font-bold text-primary">Use max</button></div>
        <input inputMode="decimal" aria-label="Transfer amount" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00 USDT" className="mt-2 h-14 w-full rounded-2xl border border-border bg-background px-4 text-lg font-bold text-foreground outline-none ring-primary/20 placeholder:text-muted-foreground/60 focus:ring-4" />
        <button disabled={busy} onClick={() => void transfer()} className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary font-black text-primary-foreground shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">{busy && <LoaderCircle className="animate-spin" size={18} />}{busy ? "Transferring…" : "Transfer now"}</button>
        {message && <p className={`mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${message.includes("successfully") ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-destructive/10 text-destructive"}`}>{message.includes("successfully") && <CheckCircle2 size={15} />}{message}</p>}
      </Card>
      <div className="grid grid-cols-2 gap-3"><button onClick={() => router.push("/trading?mode=spot")} className="rounded-3xl border border-border bg-card p-5 text-left shadow-sm"><LineChart className="text-primary" /><strong className="mt-6 block">Spot trading</strong><span className="mt-1 block text-xs text-muted-foreground">Trade supported assets</span></button><button onClick={() => router.push("/trading?mode=futures")} className="rounded-3xl border border-border bg-card p-5 text-left shadow-sm"><Wallet className="text-primary" /><strong className="mt-6 block">Futures trading</strong><span className="mt-1 block text-xs text-muted-foreground">Manage positions</span></button></div>
    </div><BottomNav />
  </main>
}

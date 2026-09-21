"use client"

import { useEffect, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { ArrowDownUp, ArrowLeft, CheckCircle2, LoaderCircle, LockKeyhole, TrendingUp, WalletCards } from "lucide-react"
import { BottomNav } from "@/components/layout/BottomNav"

const accounts = ["funding", "spot", "futures"] as const
type AccountType = typeof accounts[number]
type Account = { balance: number; available: number; locked?: number }
type Overview = { totalBalance: number; totalLocked: number; totalAvailable: number; funding: Account; spot: Account; futures: Account }
const money = (value: number) => `${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })} USDT`

export default function AssetsPage() {
  const router = useRouter()
  const [data, setData] = useState<Overview | null>(null)
  const [from, setFrom] = useState<AccountType>("funding")
  const [to, setTo] = useState<AccountType>("spot")
  const [amount, setAmount] = useState("")
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)

  const load = async () => {
    const response = await fetch("/api/assets/overview", { cache: "no-store" })
    if (!response.ok) throw new Error("Unable to load Neon account balances.")
    setData(await response.json())
  }
  useEffect(() => { void load().catch((error) => setMessage(error.message)) }, [])

  const account = (type: AccountType) => data?.[type] ?? { balance: 0, available: 0, locked: 0 }
  const transfer = async () => {
    const value = Number(amount)
    setMessage("")
    if (from === to) return setMessage("Choose different accounts.")
    if (!Number.isFinite(value) || value <= 0) return setMessage("Enter an amount greater than zero.")
    if (value > account(from).available + 1e-8) return setMessage(`Only ${money(account(from).available)} is available in ${from}.`)
    setBusy(true)
    try {
      const response = await fetch("/api/assets/transfer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ from, to, amount: value }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? "Transfer failed.")
      setAmount(""); setMessage("Transfer completed and balances updated."); await load()
    } catch (error) { setMessage(error instanceof Error ? error.message : "Transfer failed.") } finally { setBusy(false) }
  }

  return <main className="min-h-screen overflow-x-hidden bg-background pb-32 text-foreground">
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/95 p-4 backdrop-blur">
      <button aria-label="Go back" onClick={() => router.back()} className="grid size-10 place-items-center rounded-xl border border-border bg-card"><ArrowLeft size={18} /></button>
      <p className="mt-4 text-[10px] font-black uppercase tracking-[.2em] text-primary">Neon wallet architecture</p>
      <h1 className="mt-1 text-3xl font-black tracking-tight">Assets</h1>
      <p className="text-xs text-muted-foreground">Funding, spot, and futures balances with locked funds separated.</p>
    </header>
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <section className="rounded-[28px] bg-primary p-5 text-primary-foreground shadow-[0_20px_50px_rgba(0,0,0,.2)]"><p className="text-[10px] font-black uppercase tracking-[.2em] opacity-70">Total balance</p><p className="mt-2 text-4xl font-black">{money(data?.totalBalance ?? 0)}</p><div className="mt-5 grid grid-cols-2 gap-3 text-xs"><div className="rounded-2xl bg-black/10 p-3"><span className="opacity-70">Locked</span><strong className="mt-1 block">{money(data?.totalLocked ?? 0)}</strong></div><div className="rounded-2xl bg-black/10 p-3"><span className="opacity-70">Available</span><strong className="mt-1 block">{money(data?.totalAvailable ?? 0)}</strong></div></div></section>
      <AccountCard title="Funding account" icon={<WalletCards size={20} />} account={account("funding")} description="Deposit, withdraw, or transfer your available USDT." actions={<><button onClick={() => router.push("/fund-account")} className="rounded-xl bg-primary px-3 py-2 text-xs font-black text-primary-foreground">Deposit</button><button onClick={() => router.push("/withdraw")} className="rounded-xl border border-border px-3 py-2 text-xs font-black">Withdraw</button></>} />
      <AccountCard title="Spot account" icon={<TrendingUp size={20} />} account={account("spot")} description="Available balance can be used for spot trading or transfers." />
      <AccountCard title="Futures account" icon={<LockKeyhole size={20} />} account={account("futures")} description="Open position margin is locked; the remainder is available." />
      <section className="rounded-3xl border border-border bg-card p-4 shadow-sm"><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary"><ArrowDownUp size={20} /></div><div><h2 className="font-black">Transfer between accounts</h2><p className="text-xs text-muted-foreground">Atomic Neon transfer. Locked funds cannot move.</p></div></div><div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-end gap-2"><label className="min-w-0 text-[10px] font-black uppercase tracking-wider text-muted-foreground">From<select value={from} onChange={e => setFrom(e.target.value as AccountType)} className="mt-1 h-12 w-full rounded-2xl border border-border bg-background px-3 text-sm font-bold capitalize"><option value="funding">Funding</option><option value="spot">Spot</option><option value="futures">Futures</option></select></label><button aria-label="Swap accounts" onClick={() => { setFrom(to); setTo(from) }} className="mb-2 grid size-9 place-items-center rounded-full border border-border bg-background"><ArrowDownUp size={15} /></button><label className="min-w-0 text-[10px] font-black uppercase tracking-wider text-muted-foreground">To<select value={to} onChange={e => setTo(e.target.value as AccountType)} className="mt-1 h-12 w-full rounded-2xl border border-border bg-background px-3 text-sm font-bold capitalize"><option value="funding">Funding</option><option value="spot">Spot</option><option value="futures">Futures</option></select></label></div><div className="mt-4 flex justify-between text-xs text-muted-foreground"><span>Available: {money(account(from).available)}</span><button onClick={() => setAmount(String(account(from).available))} className="font-black text-primary">Use max</button></div><input inputMode="decimal" aria-label="Transfer amount" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00 USDT" className="mt-2 h-14 w-full rounded-2xl border border-border bg-background px-4 text-lg font-bold outline-none focus:ring-4 focus:ring-primary/20" /><button disabled={busy} onClick={() => void transfer()} className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary font-black text-primary-foreground disabled:opacity-60">{busy && <LoaderCircle className="animate-spin" size={18} />}{busy ? "Transferring..." : "Transfer now"}</button>{message && <p className={`mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${message.includes("completed") ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-destructive/10 text-destructive"}`}>{message.includes("completed") && <CheckCircle2 size={15} />}{message}</p>}</section>
    </div><BottomNav />
  </main>
}

function AccountCard({ title, icon, account, description, actions }: { title: string; icon: ReactNode; account: Account; description: string; actions?: ReactNode }) {
  return <section className="rounded-3xl border border-border bg-card p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary">{icon}</div><div><h2 className="font-black">{title}</h2><p className="text-xs text-muted-foreground">{description}</p></div></div>{actions && <div className="flex gap-2">{actions}</div>}</div><div className="mt-5 grid grid-cols-3 gap-2"><Metric label="Balance" value={account.balance} /><Metric label="Locked" value={account.locked ?? 0} /><Metric label="Available" value={account.available} accent /></div></section>
}
function Metric({ label, value, accent }: { label: string; value: number; accent?: boolean }) { return <div className="rounded-2xl bg-muted/60 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p><p className={`mt-1 text-sm font-black ${accent ? "text-primary" : ""}`}>{money(value)}</p></div> }

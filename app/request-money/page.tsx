"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, ArrowDownCircle, CheckCircle2 } from "lucide-react"
import { BottomNav } from "@/components/layout/BottomNav"
import { createClient } from "@/lib/supabase/client"

export default function RequestMoneyPage() {
  const router = useRouter()
  const [recipient, setRecipient] = useState("")
  const [amount, setAmount] = useState("")
  const [note, setNote] = useState("")
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  if (sent) return (
    <main className="min-h-screen bg-background px-6 py-10 text-center">
      <CheckCircle2 className="mx-auto mt-20 text-primary" size={58} />
      <h1 className="mt-6 text-2xl font-bold text-foreground">Request sent</h1>
      <p className="mt-2 text-sm text-gray-500">The request is ready for the recipient to review.</p>
      <button onClick={() => router.push('/')} className="mt-10 w-full rounded-2xl bg-primary py-4 font-bold text-white">Back home</button>
      <BottomNav />
    </main>
  )

  return (
    <main className="min-h-screen bg-background pb-28">
      <header className="flex items-center justify-between px-6 pb-6 pt-8">
        <button onClick={() => router.back()} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-gray-100 bg-gray-50"><ChevronLeft size={22} /></button>
        <h1 className="text-lg font-bold text-foreground">Request Money</h1><div className="w-10" />
      </header>
      <section className="space-y-5 px-6">
        <div className="rounded-3xl bg-white p-6 shadow-nex-soft">
          <ArrowDownCircle className="mb-4 text-accent" size={30} />
          <h2 className="text-xl font-bold text-foreground">Who are you requesting from?</h2>
          <p className="mt-1 text-sm text-gray-500">Add a recipient, amount, and optional note.</p>
        </div>
        <label className="block text-sm font-bold text-foreground">Recipient<input value={recipient} onChange={e => setRecipient(e.target.value)} placeholder="Name, APEDAT ID, or phone number" className="mt-2 w-full rounded-2xl border border-gray-100 bg-white p-4 text-sm outline-none" /></label>
        <label className="block text-sm font-bold text-foreground">Amount (USDT)<input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0.00 USDT" className="mt-2 w-full rounded-2xl border border-gray-100 bg-white p-4 text-sm outline-none" /></label>
        <label className="block text-sm font-bold text-foreground">Note <span className="font-normal text-gray-400">(optional)</span><textarea value={note} onChange={e => setNote(e.target.value)} placeholder="What is this request for?" className="mt-2 min-h-24 w-full rounded-2xl border border-gray-100 bg-white p-4 text-sm outline-none" /></label>
        {error && <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-600">{error}</p>}
        <button disabled={busy || !recipient.trim() || !Number(amount)} onClick={async () => { setBusy(true); setError(""); try { const supabase = createClient(); const { error: rpcError } = await supabase.rpc("create_money_request", { p_recipient: recipient.trim(), p_amount: Number(amount), p_note: note.trim() || null }); if (rpcError) throw new Error(rpcError.message); setSent(true) } catch (e) { setError(e instanceof Error ? e.message : "Request could not be sent.") } finally { setBusy(false) } }} className="w-full rounded-2xl bg-primary py-4 font-bold text-white disabled:opacity-40">{busy ? "Sending…" : "Send request"}</button>
      </section>
      <BottomNav />
    </main>
  )
}

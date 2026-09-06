"use client"

import Link from "next/link"
import { use, useEffect, useMemo, useState } from "react"
import { ArrowLeft, RefreshCw, Search, ShieldAlert, Users } from "lucide-react"
import { OrderActions } from "@/components/admin/order-actions"
import { DepositActions } from "@/components/admin/deposit-actions"
import { WithdrawalActions } from "@/components/admin/withdrawal-actions"
import { createClient } from "@/lib/supabase/client"
import { AdminServiceActions } from "@/components/admin/service-actions"

const labels: Record<string, string> = { orders: "Trading order queue", allocations: "Autopilot allocations", users: "Users & affiliates", wallets: "Wallets & credits", deposits: "Funding controls", withdrawals: "Withdrawals", transfers: "Transfers", payments: "Payments", "audit-log": "Audit log", p2p: "P2P monitoring", merchants: "Merchants & tiers", risk: "Risk controls", "market-data": "Market data", "data-purchases": "Data purchase requests" }
const sources: Record<string, string> = { orders: "orders", deposits: "deposits", withdrawals: "withdrawals", transfers: "sends", payments: "payments", "audit-log": "ledger", "data-purchases": "data", p2p: "sends", users: "users", wallets: "wallets", allocations: "allocations", merchants: "merchantApplications" }
type Item = Record<string, unknown> & { id?: string; status?: string; created_at?: string }

export default function AdminSection({ params }: { params: Promise<{ section: string }> }) {
  const { section } = use(params)
  const [payload, setPayload] = useState<Record<string, unknown[]>>({})
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = async () => {
    setLoading(true); setError("")
    try {
      const response = await fetch("/api/admin/requests", { cache: "no-store" })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Unable to load admin records.")
      setPayload(result)
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load admin records.") }
    finally { setLoading(false) }
  }
  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 10000); const supabase = createClient(); const channel = supabase.channel("admin-live").on("postgres_changes", { event: "*", schema: "public" }, () => { void load() }).subscribe(); const onFocus = () => void load(); window.addEventListener("focus", onFocus); return () => { window.clearInterval(timer); window.removeEventListener("focus", onFocus); void supabase.removeChannel(channel) } }, [])

  const requestedStatus = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("status") || "" : ""
  const records = useMemo(() => {
    const list = (payload[sources[section]] || []) as Item[]
    return list.filter(item => {
      const status = String(item.status || "").replace("pending_admin", "pending")
      const matchesStatus = section !== "orders" || !requestedStatus || status === requestedStatus
      return matchesStatus && JSON.stringify(item).toLowerCase().includes(query.toLowerCase())
    })
  }, [payload, section, query, requestedStatus])
  const title = labels[section] || "Admin module"

  return <main className="min-h-screen bg-[#101A18] p-4 text-[#EAF4F0] md:p-8"><div className="mx-auto max-w-6xl">
    <div className="flex items-center justify-between gap-3"><Link href="/admin" className="inline-flex items-center gap-2 text-xs font-bold text-[#55D6A7]"><ArrowLeft size={15}/>Back to overview</Link><button onClick={() => void load()} aria-label="Refresh module" className="rounded-xl border border-[#29413A] p-2 text-[#55D6A7]"><RefreshCw size={16}/></button></div>
    <p className="mt-8 text-xs font-bold uppercase tracking-[0.2em] text-[#55D6A7]">Live Supabase operations</p><h1 className="mt-2 text-3xl font-black">{title}</h1><p className="mt-2 text-sm leading-6 text-[#9BB8AF]">Automatically refreshed from the operational database every 10 seconds.</p>
    {section === "users" && <p className="mt-4 flex items-center gap-2 rounded-xl bg-[#153B2F] p-3 text-xs text-[#8DE0BD]"><Users size={15}/> {payload.users?.length || 0} registered Supabase users</p>}
    <div className="mt-6 flex items-center gap-2 rounded-2xl border border-[#29413A] bg-[#15231F] px-3 py-2"><Search size={16} className="text-[#8CB4A8]"/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search live records" className="w-full bg-transparent text-sm outline-none placeholder:text-[#668078]"/></div>
    {error && <div className="mt-6 flex items-center gap-2 rounded-2xl border border-[#713B3B] bg-[#321E20] p-4 text-xs text-[#FFB4B4]"><ShieldAlert size={17}/>{error}</div>}
    <div className="mt-6 overflow-hidden rounded-2xl border border-[#29413A] bg-[#15231F]"><div className="flex items-center justify-between border-b border-[#29413A] px-4 py-3"><b className="text-sm">{loading ? "Loading live records…" : `${records.length} records`}</b>{section === "orders" && <div className="flex gap-1 overflow-x-auto"><Link href="/admin/orders?status=pending" className="whitespace-nowrap rounded-lg bg-[#20362E] px-2 py-1 text-[10px] text-[#8DE0BD]">Pending</Link><Link href="/admin/orders?status=open" className="whitespace-nowrap rounded-lg bg-[#20362E] px-2 py-1 text-[10px] text-[#8DE0BD]">Open</Link><Link href="/admin/orders?status=partially_filled" className="whitespace-nowrap rounded-lg bg-[#20362E] px-2 py-1 text-[10px] text-[#8DE0BD]">Partial</Link><Link href="/admin/orders?status=filled" className="whitespace-nowrap rounded-lg bg-[#20362E] px-2 py-1 text-[10px] text-[#8DE0BD]">Filled</Link><Link href="/admin/orders?status=rejected" className="whitespace-nowrap rounded-lg bg-[#20362E] px-2 py-1 text-[10px] text-[#8DE0BD]">Rejected</Link></div>}</div>
    {records.length === 0 && !loading ? <div className="p-8 text-center text-sm text-[#8CB4A8]">No records found for this module.</div> : <div className="divide-y divide-[#29413A]">{records.map((item, index) => <div key={String(item.id || index)} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between"><div className="min-w-0">{section === "users" && item.id ? <Link href={`/admin/users/${String(item.id)}`} className="truncate text-xs font-bold text-[#8DE0BD] underline-offset-2 hover:underline">{String(item.email || item.name || item.id)}</Link> : <p className="truncate text-xs font-bold">{String(item.email || item.market || item.name || item.profile_name || item.id || "Operational record")}</p>}<p className="mt-1 text-[10px] text-[#8CB4A8]">{String(item.user_id || item.type || item.phone || "No user reference")} · {item.created_at ? new Date(item.created_at).toLocaleString() : "No timestamp"}</p>
              {section === "deposits" && <div className="mt-2 grid gap-x-4 gap-y-1 text-[10px] text-[#A9C4BB] sm:grid-cols-2"><span>Amount: {String(item.amount ?? "—")} {String(item.currency || "NGN")}</span><span>Sender bank: {String(item.sender_bank || "—")}</span><span>Destination: {String(item.bank_name || "—")} · {String(item.account_number || "—")}</span><span>Reference: {String(item.reference || "—")}</span><span>Proof: {String(item.screenshot_url || "Not supplied")}</span><span>Review: {String(item.reviewed_by || "Pending")}</span></div>}
              {section === "withdrawals" && <div className="mt-2 grid gap-x-4 gap-y-1 text-[10px] text-[#A9C4BB] sm:grid-cols-2"><span>Amount: {String(item.amount ?? "—")} {String(item.currency || "")}</span><span>Destination: {String(item.destination_type || "—")}</span><span>Target: {String(item.destination || "—")}</span><span>Network: {String(item.network || "—")}</span><span>Provider ref: {String(item.provider_reference || "—")}</span><span>Reservation: {String(item.reservation_status || "—")}</span></div>}</div><div className="flex flex-col items-end gap-2"><span className="w-fit rounded-lg bg-[#20362E] px-2 py-1 text-[10px] font-bold text-[#8DE0BD]">{String(item.status || "received")}</span>{section === "orders" && item.id && <OrderActions id={String(item.id)} />}{section === "deposits" && item.id && String(item.status) === "pending" && <DepositActions id={String(item.id)} onDone={() => void load()} />}
{section === "withdrawals" && item.id && <WithdrawalActions id={String(item.id)} status={String(item.status || "")} onDone={() => void load()} />}
              {(["airtime","data-purchases","payments","p2p","merchants"] as string[]).includes(section) && item.id && <AdminServiceActions resource={section === "data-purchases" ? "data" : section === "merchants" ? "merchant" : section === "payments" ? "bills" : section === "p2p" ? "scan" : "airtime"} id={String(item.id)} status={String(item.status || "pending")} onDone={() => void load()} />}</div></div>)}</div>}
    </div>
  </div></main>
}

export function AdminSectionPage({ params }: { params: Promise<{ section: string }> }) { return <AdminSection params={params} /> }

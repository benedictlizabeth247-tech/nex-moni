"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { ArrowLeft, BadgeCheck, ClipboardList, ShieldCheck, Users, WalletCards } from "lucide-react"
import { Card } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"

type Tile = { label: string; description: string; href: string; icon: typeof Users }
const tiles: Tile[] = [
  { label: "Users & affiliates", description: "Customer profiles, referrals, and account operations.", href: "/admin/users", icon: Users },
  { label: "Funding controls", description: "Deposits, withdrawals, wallets, and credit holds.", href: "/admin/wallets", icon: WalletCards },
  { label: "Trading order queue", description: "Review pending orders before internal execution.", href: "/admin/orders?status=pending", icon: ClipboardList },
  { label: "Merchant approvals", description: "Review merchant verification and tier requests.", href: "/admin/merchants", icon: BadgeCheck },
]

export default function AffiliateAdmin() {
  const [email, setEmail] = useState("")
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      const value = (data.user?.email || "").trim()
      setEmail(value)
      setChecking(false)
    })
  }, [])

  if (checking) return <main className="flex min-h-screen items-center justify-center bg-[#101A18] p-5 text-[#EAF4F0]"><p className="text-sm">Checking staff access…</p></main>

  return <main className="min-h-screen bg-[#101A18] p-4 pb-10 text-[#EAF4F0] md:p-8"><div className="mx-auto max-w-5xl">
    <header className="flex items-center gap-3"><Link aria-label="Back to admin" href="/admin" className="rounded-xl border border-[#29413A] p-2"><ArrowLeft size={18}/></Link><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8CB4A8]">nexMonie operations</p><h1 className="text-xl font-black md:text-3xl">Affiliate control dashboard</h1></div></header>
    <Card className="mt-6 rounded-3xl border-[#29413A] bg-[#15231F] p-4"><div className="flex items-center gap-2"><ShieldCheck size={18} className="text-[#55D6A7]"/><b className="text-sm">Staff access verified</b></div><p className="mt-2 text-xs text-[#9BB8AF]">{email}</p></Card>
    <section className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2"><h2 className="sr-only">Operations</h2>{tiles.map(({ label, description, href, icon: Icon }) => <Link key={href} href={href} className="min-h-32 rounded-2xl border border-[#29413A] bg-[#15231F] p-4 transition active:scale-[.98] hover:border-[#55D6A7]"><Icon size={20} className="text-[#55D6A7]"/><b className="mt-4 block text-sm">{label}</b><p className="mt-1 text-xs leading-5 text-[#9BB8AF]">{description}</p><span className="mt-3 block text-[10px] font-bold text-[#55D6A7]">Open module →</span></Link>)}</section>
  </div></main>
}

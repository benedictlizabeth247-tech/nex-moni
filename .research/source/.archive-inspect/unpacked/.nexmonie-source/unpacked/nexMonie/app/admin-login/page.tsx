"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { ShieldCheck, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NexLogo } from "@/components/ui/NexLogo"



function AdminLoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const normalized = email.trim().toLowerCase()
    try {
      const supabase = createClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: normalized, password })
      if (signInError) throw signInError

      // Do not trust the typed email. The server must confirm the authenticated
      // Supabase user has an active admin_staff record before we enter /admin.
      const authorization = await fetch('/api/admin/session', { cache: 'no-store' })
      if (!authorization.ok) {
        await supabase.auth.signOut()
        throw new Error('ADMIN_ACCESS_REQUIRED')
      }

      const destination = searchParams.get("next") || "/admin"
      router.replace(destination)
      router.refresh()
    } catch (cause) {
      const code = (cause as { code?: string })?.code
      const message = cause instanceof Error ? cause.message : ''
      setError(code === "invalid_credentials" ? "Invalid admin email or password." : message === 'ADMIN_ACCESS_REQUIRED' ? "This account is not authorized for the NexMonie admin dashboard." : "Admin sign-in failed. Please check your credentials and try again.")
    } finally {
      setBusy(false)
    }
  }

  return <main className="flex min-h-screen w-full items-center justify-center bg-[#0D0F11] px-5 py-8 text-[#F4F1EF]">
    <div className="w-full max-w-sm">
      <div className="mb-8 flex flex-col items-center gap-4">
        <NexLogo className="[&_*]:!text-[#F4F1EF]" />
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#183A36] text-[#55D6A7]"><ShieldCheck size={25}/></div>
        <div className="text-center"><h1 className="text-xl font-black">Admin sign-in</h1><p className="mt-1 text-xs text-[#8D959D]">Authorized NexMonie operations access</p></div>
      </div>
      <form onSubmit={submit} className="space-y-4 rounded-3xl border border-[#30343A] bg-[#171A1E] p-5">
        <div className="space-y-2"><Label htmlFor="admin-email" className="text-xs font-bold uppercase tracking-wide text-[#8D959D]">Admin email</Label><Input id="admin-email" type="email" required autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} className="h-12 rounded-2xl border-[#30343A] bg-[#0D0F11] text-white" /></div>
        <div className="space-y-2"><Label htmlFor="admin-password" className="text-xs font-bold uppercase tracking-wide text-[#8D959D]">Password</Label><Input id="admin-password" type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} className="h-12 rounded-2xl border-[#30343A] bg-[#0D0F11] text-white" /></div>
        {error && <p className="rounded-xl bg-[#321E20] px-3 py-2.5 text-xs font-semibold text-[#FFB4B4]">{error}</p>}
        <Button disabled={busy} className="h-12 w-full rounded-2xl bg-[#55D6A7] font-black text-[#102019] hover:bg-[#55D6A7]/90">{busy ? <><Loader2 size={16} className="mr-2 animate-spin"/>Signing in…</> : "Enter Admin Dashboard"}</Button>
        <Link href="/admin-login/forgot-password" className="block text-center text-xs font-bold text-[#55D6A7]">Forgot password?</Link>
      </form>
      <p className="mt-5 text-center text-[10px] text-[#6F777F]">Admin access is verified again against the Supabase admin_staff record.</p>
    </div>
  </main>
}

export default function Page(){ return <Suspense fallback={null}><AdminLoginForm/></Suspense> }

'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function SignUpPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)
    setLoading(true)
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ?? `${window.location.origin}/auth/callback` },
    })
    setLoading(false)
    if (signUpError) {
      setError(signUpError.message.toLowerCase().includes('password') ? signUpError.message : 'Unable to create your account. Please check your details and try again.')
      return
    }
    if (data.session) {
      router.replace('/')
      router.refresh()
    } else {
      setMessage('Check your email to confirm your account, then sign in.')
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F2F1EF] px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-[#E1D5D1] bg-[#FFFDFB] p-6 shadow-[0_14px_40px_rgba(80,55,50,.08)]">
        <p className="text-xs font-black uppercase tracking-[.2em] text-[#9A7772]">nexMonie</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-[#342A28]">Create your account</h1>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block text-sm font-semibold text-[#4A3936]">Email<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-[#E1D5D1] bg-white px-3 py-3 outline-none focus:border-[#D86F68]" /></label>
          <label className="block text-sm font-semibold text-[#4A3936]">Password<input required minLength={8} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-[#E1D5D1] bg-white px-3 py-3 outline-none focus:border-[#D86F68]" /></label>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          {message && <p role="status" className="text-sm text-green-700">{message}</p>}
          <button disabled={loading} className="w-full rounded-xl bg-[#342A28] px-4 py-3 font-bold text-white disabled:opacity-60">{loading ? 'Creating account…' : 'Create account'}</button>
        </form>
        <p className="mt-5 text-center text-sm text-[#6F5C57]">Already registered? <Link href="/auth/login" className="font-bold text-[#A64F49]">Sign in</Link></p>
      </section>
    </main>
  )
}

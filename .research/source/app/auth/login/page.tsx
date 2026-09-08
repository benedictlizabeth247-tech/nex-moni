'use client'

import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NexLogo } from '@/components/ui/NexLogo'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'

// Only the credential/existence signal is genericized — naming it would confirm
// whether an email is registered. Errors the user can act on are passed through,
// and anything unexpected is reported as such instead of as a wrong password.
function loginErrorMessage(error: unknown): string {
  const { code, status } = (error ?? {}) as { code?: string; status?: number }

  if (code === 'email_not_confirmed') {
    return 'Please confirm your email address — check your inbox for the link.'
  }
  if (code === 'over_request_rate_limit' || status === 429) {
    return 'Too many attempts. Please wait a moment and try again.'
  }
  if (code === 'invalid_credentials') {
    return 'Invalid email or password.'
  }
  return 'Something went wrong. Please try again.'
}

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectedFrom = searchParams.get('redirectedFrom')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      const destination = redirectedFrom || '/'
      router.push(destination)
      router.refresh()
    } catch (error: unknown) {
      setError(loginErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-[#0D0F11] px-4 py-6 text-[#F4F1EF] sm:px-6 sm:py-10">
      <div className="w-full max-w-sm min-w-0">
        <div className="mb-7 flex flex-col items-center gap-3 sm:mb-10 sm:gap-4">
          <div className="[&_*]:!text-[#F4F1EF]"><NexLogo className="scale-90 sm:scale-100" /></div>
          <p className="text-center text-[13px] font-medium text-[#8D959D]">
            Welcome back. Sign in to continue.
          </p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-4 sm:gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wide text-[#8D959D]">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 rounded-xl border-[#30343A] bg-[#171A1E] text-[#F4F1EF] placeholder:text-[#8D959D] sm:h-12 sm:rounded-2xl"
            />
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wide text-[#8D959D]">
                Password
              </Label>
            </div>
            <Input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 rounded-xl border-[#30343A] bg-[#171A1E] text-[#F4F1EF] placeholder:text-[#8D959D] sm:h-12 sm:rounded-2xl"
            />
          </div>

          {error && (
            <p className="rounded-xl bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={isLoading}
            className="h-11 w-full rounded-xl bg-primary text-sm font-bold text-primary-foreground hover:bg-primary/90 sm:h-12 sm:rounded-2xl sm:text-[15px]"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                Signing in...
              </span>
            ) : (
              'Sign in'
            )}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-[#F4F1EF]">
          Don&apos;t have an account?{' '}
          <Link href="/auth/sign-up" className="font-bold text-primary underline-offset-4 hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}

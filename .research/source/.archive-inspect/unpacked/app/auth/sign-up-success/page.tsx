import { NexLogo } from '@/components/ui/NexLogo'
import { MailCheck } from 'lucide-react'
import Link from 'next/link'

export default function Page() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-[#F8FAF9] px-6 py-10 text-center">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-4">
          <NexLogo />
        </div>

        <div className="flex flex-col items-center gap-4 rounded-3xl bg-white p-8 shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <MailCheck size={26} className="text-primary" />
          </div>
          <h1 className="text-lg font-bold text-foreground">Check your email</h1>
          <p className="text-sm leading-relaxed text-gray-500">
            We&apos;ve sent a confirmation link to your inbox. Confirm your email address to activate your account
            and sign in.
          </p>
        </div>

        <p className="mt-6 text-sm text-gray-500">
          Already confirmed?{' '}
          <Link href="/auth/login" className="font-bold text-primary underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}

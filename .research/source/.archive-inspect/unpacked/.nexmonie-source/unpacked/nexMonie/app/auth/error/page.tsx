import { NexLogo } from '@/components/ui/NexLogo'
import { AlertTriangle } from 'lucide-react'
import Link from 'next/link'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error: string }>
}) {
  const params = await searchParams
  // `error` comes from the URL, so it is attacker-controlled. Render it only
  // when it looks like a Supabase error code, never as free text someone can
  // choose — otherwise this card will happily display their phishing copy.
  const code = params?.error
  const isErrorCode = typeof code === 'string' && /^[a-z0-9_]{1,64}$/.test(code)

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-[#F8FAF9] px-6 py-10 text-center">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-4">
          <NexLogo />
        </div>

        <div className="flex flex-col items-center gap-4 rounded-3xl bg-white p-8 shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle size={26} className="text-destructive" />
          </div>
          <h1 className="text-lg font-bold text-foreground">Something went wrong</h1>
          {isErrorCode ? (
            <p className="text-sm text-gray-500">Error code: {code}</p>
          ) : (
            <p className="text-sm text-gray-500">An unspecified error occurred while authenticating.</p>
          )}
        </div>

        <p className="mt-6 text-sm text-gray-500">
          <Link href="/auth/login" className="font-bold text-primary underline-offset-4 hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}

'use client'

import { Button } from '@/components/ui/button'
import { NexLogo } from '@/components/ui/NexLogo'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectedFrom = searchParams.get('redirectedFrom')

  const enterApp = () => {
    router.replace(redirectedFrom || '/')
  }

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-[#0D0F11] px-4 py-6 text-[#F4F1EF] sm:px-6 sm:py-10">
      <div className="w-full max-w-sm min-w-0">
        <div className="mb-7 flex flex-col items-center gap-3 sm:mb-10 sm:gap-4">
          <div className="[&_*]:!text-[#F4F1EF]"><NexLogo className="scale-90 sm:scale-100" /></div>
          <p className="text-center text-[13px] font-medium text-[#8D959D]">
            Welcome back. Continue to the app.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <p className="text-center text-sm leading-6 text-[#8D959D]">
            No account or password is required. Enter the app directly.
          </p>
          <Button
            type="button"
            onClick={enterApp}
            className="h-11 w-full rounded-xl bg-primary text-sm font-bold text-primary-foreground hover:bg-primary/90 sm:h-12 sm:rounded-2xl sm:text-[15px]"
          >
            Enter app
          </Button>
        </div>
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

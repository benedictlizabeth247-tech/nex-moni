'use client'

import { SignUp } from '@clerk/nextjs'

export default function Page() {
  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-[#F8FAF9] px-4 py-8">
      <SignUp path="/auth/sign-up" routing="path" signInUrl="/auth/login" forceRedirectUrl="/" />
    </main>
  )
}

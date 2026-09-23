'use client'

import { SignIn } from '@clerk/nextjs'

export default function Page() {
  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-[#0D0F11] px-4 py-8">
      <SignIn path="/auth/login" routing="path" signUpUrl="/auth/sign-up" forceRedirectUrl="/" />
    </main>
  )
}

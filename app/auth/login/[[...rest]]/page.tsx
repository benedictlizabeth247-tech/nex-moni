'use client'

import { SignIn } from '@clerk/nextjs'
import { NexLogo } from '@/components/ui/NexLogo'

export default function Page() {
  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-[#0D0F11] px-4 py-6 text-[#F4F1EF] sm:px-6 sm:py-10">
      <div className="w-full max-w-sm min-w-0">
        <div className="mb-7 flex flex-col items-center gap-3 sm:mb-10 sm:gap-4">
          <div className="[&_*]:!text-[#F4F1EF]"><NexLogo className="scale-90 sm:scale-100" /></div>
          <p className="text-center text-[13px] font-medium text-[#8D959D]">
            Welcome back. Sign in to continue.
          </p>
        </div>
        <SignIn
          path="/auth/login"
          routing="path"
          signUpUrl="/auth/sign-up"
          forceRedirectUrl="/"
          appearance={{
            elements: {
              rootBox: 'w-full',
              card: 'w-full max-w-none bg-transparent p-0 shadow-none',
              headerTitle: 'sr-only',
              headerSubtitle: 'sr-only',
              socialButtonsBlockButton: 'h-11 rounded-xl border-[#30343A] bg-[#171A1E] text-[#F4F1EF] hover:bg-[#20242A] sm:h-12 sm:rounded-2xl',
              dividerLine: 'bg-[#30343A]',
              dividerText: 'text-[#8D959D]',
              formFieldLabel: 'text-xs font-bold uppercase tracking-wide text-[#8D959D]',
              formFieldInput: 'h-11 rounded-xl border-[#30343A] bg-[#171A1E] text-[#F4F1EF] placeholder:text-[#8D959D] sm:h-12 sm:rounded-2xl',
              formButtonPrimary: 'h-11 rounded-xl bg-[#C5A46D] text-[#161719] hover:bg-[#D4B77F] sm:h-12 sm:rounded-2xl',
              footerActionLink: 'text-[#C5A46D] hover:text-[#D4B77F]',
              identityPreviewEditButton: 'text-[#C5A46D]',
            },
          }}
        />
      </div>
    </main>
  )
}

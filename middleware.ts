import { auth } from '@/lib/auth'

export default auth.middleware({ loginUrl: '/auth/login' })

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth|auth/login|auth/sign-up|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}

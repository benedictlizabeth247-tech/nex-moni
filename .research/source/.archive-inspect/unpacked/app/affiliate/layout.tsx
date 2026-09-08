import { redirect } from 'next/navigation'
import { getAdminContext } from '@/lib/admin'

export default async function AffiliateLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminContext()
  if (!admin) redirect('/auth/login?redirectedFrom=%2Faffiliate')
  return <>{children}</>
}

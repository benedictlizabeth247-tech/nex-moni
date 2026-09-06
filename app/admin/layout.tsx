import { redirect } from 'next/navigation'
import { getAdminContext } from '@/lib/admin'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminContext()
  if (!admin) redirect('/admin-login?next=%2Fadmin')
  return <>{children}</>
}

import { redirect } from 'next/navigation'
export default function OpenOrders() { redirect('/admin/orders?status=open') }

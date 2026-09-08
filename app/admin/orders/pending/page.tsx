import { redirect } from 'next/navigation'
export default function PendingOrders() { redirect('/admin/orders?status=pending') }

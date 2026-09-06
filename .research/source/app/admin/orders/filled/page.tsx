import { redirect } from 'next/navigation'
export default function FilledOrders() { redirect('/admin/orders?status=filled') }

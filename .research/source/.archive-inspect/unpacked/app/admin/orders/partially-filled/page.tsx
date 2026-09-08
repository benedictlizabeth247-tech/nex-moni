import { redirect } from 'next/navigation'
export default function PartialOrders() { redirect('/admin/orders?status=partially_filled') }

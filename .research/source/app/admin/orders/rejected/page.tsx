import { redirect } from 'next/navigation'
export default function RejectedOrders() { redirect('/admin/orders?status=rejected') }

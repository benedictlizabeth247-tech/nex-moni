import Link from 'next/link'

export default async function AdminOrderDetail({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params
  return <main className="min-h-screen bg-[#101A18] p-4 text-[#EAF4F0] md:p-8"><div className="mx-auto max-w-4xl"><Link href="/admin/orders" className="text-xs font-bold text-[#55D6A7]">← Back to orders</Link><p className="mt-8 text-xs font-bold uppercase tracking-[0.2em] text-[#55D6A7]">Order detail</p><h1 className="mt-2 text-3xl font-black">{orderId}</h1><div className="mt-8 rounded-2xl border border-[#29413A] bg-[#15231F] p-5"><p className="text-sm font-bold">Transactional review required</p><p className="mt-2 text-xs leading-5 text-[#8CB4A8]">Fill, reject, and cancel actions will be connected only through atomic ledger-backed server actions. No client-side balance mutation is permitted.</p></div></div></main>
}

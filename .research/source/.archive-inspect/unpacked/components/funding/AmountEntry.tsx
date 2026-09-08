"use client"

import { Delete } from 'lucide-react'
import { Card } from '@/components/ui/card'

type Props = {
  value: string
  onChange: (value: string) => void
  currency?: string
  label?: string
  available?: string
  max?: number
}

export function AmountEntry({ value, onChange, currency = 'USD', label = 'Enter amount', available, max = 12 }: Props) {
  const press = (key: string) => {
    if (key === 'back') return onChange(value.slice(0, -1))
    if (key === '.') {
      if (value.includes('.')) return
      return onChange(value ? `${value}.` : '0.')
    }
    if (value.replace('.', '').length >= max) return
    onChange(value === '0' ? key : `${value}${key}`)
  }

  const setQuick = (fraction: number) => {
    if (!available) return
    const n = Number(available.replace(/[^0-9.]/g, ''))
    if (!Number.isFinite(n)) return
    onChange(String(Math.floor(n * fraction * 100) / 100))
  }

  return (
    <Card className="overflow-hidden rounded-[30px] border-[#D7E0DD] bg-white p-2.5 shadow-[0_18px_50px_rgba(24,58,54,0.08)]">
      <div className="mb-2 flex items-center justify-between px-1.5 text-[8px] font-black uppercase tracking-[0.18em] text-[#6A7A75]">
        <span>Amount</span>
        <span>{currency}</span>
      </div>
      <div className="rounded-[25px] bg-[#EAF1FF] px-4 pb-6 pt-5 text-center ring-1 ring-[#D6E3FF]">
        <div className="flex items-center justify-between text-left">
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#5273C8]">{label}</p>
          {available && <p className="text-[9px] font-bold text-[#5273C8]">Available {available}</p>}
        </div>
        <div className="mt-5 flex min-h-[82px] items-end justify-center gap-2 overflow-hidden">
          <span className="pb-2 text-[17px] font-black text-[#315FCB]">{currency}</span>
          <span className="max-w-full break-all text-[56px] font-black leading-none tracking-[-0.045em] text-[#10224D]">{value || '0'}</span>
        </div>
        <div className="mx-auto mt-5 h-px max-w-[330px] bg-[#BFD0FA]" />
      </div>

      {available && (
        <div className="grid grid-cols-3 gap-2 px-2 pt-3">
          {[['25%', 0.25], ['50%', 0.5], ['MAX', 1]].map(([labelText, fraction]) => (
            <button key={String(labelText)} type="button" onClick={() => setQuick(Number(fraction))} className="h-9 rounded-xl border border-[#D9E2F2] bg-[#F8FAFF] text-[9px] font-black text-[#315FCB]">
              {labelText}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 p-1.5 pt-3">
        {['1','2','3','4','5','6','7','8','9','.','0','back'].map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => press(key)}
            aria-label={key === 'back' ? 'Delete' : `Enter ${key}`}
            className="flex h-[60px] items-center justify-center rounded-2xl border border-[#DDE4EF] bg-white text-[20px] font-black text-[#17201D] transition-transform active:scale-[0.98]"
          >
            {key === 'back' ? <Delete size={20} strokeWidth={2.5} /> : key}
          </button>
        ))}
      </div>
    </Card>
  )
}

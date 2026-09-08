'use client'

import { Delete } from 'lucide-react'

export function NumericKeypad({
  onKey,
  onDelete,
}: {
  onKey: (digit: string) => void
  onDelete: () => void
}) {
  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9']
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {digits.map((digit) => (
        <button
          key={digit}
          type="button"
          onClick={() => onKey(digit)}
          className="rounded-2xl bg-white py-4 text-2xl font-bold text-[#1A1A1A] shadow-nex-soft transition-transform active:scale-95"
        >
          {digit}
        </button>
      ))}
      <div aria-hidden="true" />
      <button
        type="button"
        onClick={() => onKey('0')}
        className="rounded-2xl bg-white py-4 text-2xl font-bold text-[#1A1A1A] shadow-nex-soft transition-transform active:scale-95"
      >
        0
      </button>
      <button
        type="button"
        aria-label="Delete last digit"
        onClick={onDelete}
        className="flex items-center justify-center rounded-2xl bg-white py-4 text-[#1A1A1A] shadow-nex-soft transition-transform active:scale-95"
      >
        <Delete size={24} aria-hidden="true" />
      </button>
    </div>
  )
}

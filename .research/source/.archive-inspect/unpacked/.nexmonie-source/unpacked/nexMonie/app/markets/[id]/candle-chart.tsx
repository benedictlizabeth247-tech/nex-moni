"use client"

/**
 * @fileOverview Price chart for the Asset Detail screen.
 *
 * Renders the candle series returned by `/api/market/candles`. Recharts is
 * already a project dependency, so no new charting library is introduced.
 */

import React, { useId, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  YAxis,
} from 'recharts'

import type { Candle } from '@/services/market-data/types'
import { formatPrice, formatClock } from '@/lib/market-format'

interface CandleChartProps {
  candles: Candle[]
  up: boolean
}

export function CandleChart({ candles, up }: CandleChartProps) {
  const [chartMode, setChartMode] = useState<'line' | 'candles'>('line')
  const gradientId = useId().replace(/:/g, '')
  const stroke = up ? '#2D9D83' : '#C45B5B'

  const data = useMemo(
    () => candles.map((candle) => ({ ...candle })),
    [candles],
  )
  const candleDomain = useMemo<[number, number]>(() => {
    const values = data.flatMap((d) => [d.high, d.low]).filter(Number.isFinite)
    if (!values.length) return [0, 1]
    const min = Math.min(...values)
    const max = Math.max(...values)
    const pad = (max - min) * 0.08 || Math.abs(max) * 0.01 || 1
    return [min - pad, max + pad]
  }, [data])
  const scaleY = (value: number) => 8 + ((candleDomain[1] - value) / (candleDomain[1] - candleDomain[0])) * 164

  const domain = useMemo<[number, number]>(() => {
    const closes = data.map((d) => d.close).filter((v) => Number.isFinite(v))
    if (!closes.length) return [0, 1]
    const min = Math.min(...closes)
    const max = Math.max(...closes)
    // Pad so the line never touches the container edges.
    const pad = (max - min) * 0.08 || Math.abs(max) * 0.01 || 1
    return [min - pad, max + pad]
  }, [data])

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-end gap-1" role="group" aria-label="Chart type">
        <button type="button" onClick={() => setChartMode('line')} aria-pressed={chartMode === 'line'} className={`rounded-md px-2 py-1 text-[10px] font-bold ${chartMode === 'line' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>Line</button>
        <button type="button" onClick={() => setChartMode('candles')} aria-pressed={chartMode === 'candles'} className={`rounded-md px-2 py-1 text-[10px] font-bold ${chartMode === 'candles' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>Candles</button>
      </div>
      <div className="h-56 w-full">
      {chartMode === 'candles' ? (
        <svg viewBox="0 0 1000 180" className="h-full w-full" role="img" aria-label="Candlestick price chart" preserveAspectRatio="none">
          {data.map((candle, index) => {
            const x = 10 + (index / Math.max(data.length - 1, 1)) * 980
            const bodyTop = Math.min(scaleY(candle.open), scaleY(candle.close))
            const bodyHeight = Math.max(Math.abs(scaleY(candle.open) - scaleY(candle.close)), 2)
            const color = candle.close >= candle.open ? '#2D9D83' : '#C45B5B'
            return <g key={candle.time}><line x1={x} x2={x} y1={scaleY(candle.high)} y2={scaleY(candle.low)} stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" /><rect x={x - Math.max(2, 380 / Math.max(data.length, 1))} y={bodyTop} width={Math.max(4, 760 / Math.max(data.length, 1))} height={bodyHeight} fill={color} rx="1" /></g>
          })}
        </svg>
      ) : (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id={`${gradientId}-assetFill`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.28} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis domain={domain} hide />
          <Tooltip
            contentStyle={{
              borderRadius: 16,
              border: 'none',
              boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
              fontSize: 12,
            }}
            labelFormatter={(value) => formatClock(Number(value))}
            formatter={(value: number) => [formatPrice(value, ''), 'Price']}
          />
          <Area
            type="monotone"
            dataKey="close"
            stroke={stroke}
            strokeWidth={2}
            fill={`url(#${gradientId}-assetFill)`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
      )}
      </div>
    </div>
  )
}

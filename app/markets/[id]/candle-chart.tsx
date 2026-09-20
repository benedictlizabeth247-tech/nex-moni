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
  const [activeTool, setActiveTool] = useState<'cursor' | 'line' | 'horizontal' | 'clear'>('cursor')
  const [drawnLine, setDrawnLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null)
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
  const handleDrawingClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool === 'cursor') return
    const rect = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * 1000
    const y = ((event.clientY - rect.top) / rect.height) * 180
    if (activeTool === 'horizontal') {
      setDrawnLine({ x1: 0, y1: y, x2: 1000, y2: y })
      return
    }
    if (!drawStart) setDrawStart({ x, y })
    else {
      setDrawnLine({ x1: drawStart.x, y1: drawStart.y, x2: x, y2: y })
      setDrawStart(null)
    }
  }

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
    <div className="flex h-full max-h-full w-full min-h-0 flex-col overflow-hidden" style={{ contain: 'layout paint size' }}>
      <div className="mb-2 flex items-center gap-2"><div className="flex flex-col gap-1 rounded-lg border border-[#D6E1DE] bg-white p-1" role="toolbar" aria-label="Drawing tools"><button type="button" title="Select" onClick={() => setActiveTool('cursor')} className={`rounded px-2 py-1 text-[9px] font-bold ${activeTool === 'cursor' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>↖</button><button type="button" title="Trend line" onClick={() => setActiveTool('line')} className={`rounded px-2 py-1 text-[9px] font-bold ${activeTool === 'line' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>╱</button><button type="button" title="Horizontal line" onClick={() => setActiveTool('horizontal')} className={`rounded px-2 py-1 text-[9px] font-bold ${activeTool === 'horizontal' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>—</button><button type="button" title="Clear drawings" onClick={() => { setDrawnLine(null); setDrawStart(null); setActiveTool('cursor') }} className="rounded px-2 py-1 text-[9px] font-bold text-muted-foreground">×</button></div><div className="flex flex-1 items-center justify-end gap-1" role="group" aria-label="Chart type">
        <button type="button" onClick={() => setChartMode('line')} aria-pressed={chartMode === 'line'} className={`rounded-md px-2 py-1 text-[10px] font-bold ${chartMode === 'line' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>Line</button>
        <button type="button" onClick={() => setChartMode('candles')} aria-pressed={chartMode === 'candles'} className={`rounded-md px-2 py-1 text-[10px] font-bold ${chartMode === 'candles' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>Candles</button>
      </div></div>
      <div className="relative min-h-0 max-h-full flex-1 w-full overflow-hidden rounded-lg" onClick={handleDrawingClick}>{drawnLine && <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full" viewBox="0 0 1000 180" preserveAspectRatio="none" aria-label="Saved chart drawing"><line x1={drawnLine.x1} y1={drawnLine.y1} x2={drawnLine.x2} y2={drawnLine.y2} stroke="#9B5B52" strokeWidth="2" strokeDasharray={activeTool === 'horizontal' ? '6 4' : undefined} /></svg>}
      {chartMode === 'candles' ? (
        <svg viewBox="0 0 1000 180" className="block h-full w-full overflow-hidden" role="img" aria-label="Candlestick price chart" preserveAspectRatio="none">
          {data.map((candle, index) => {
            const x = 10 + (index / Math.max(data.length - 1, 1)) * 980
            const bodyTop = Math.min(scaleY(candle.open), scaleY(candle.close))
            const bodyHeight = Math.max(Math.abs(scaleY(candle.open) - scaleY(candle.close)), 2)
            const color = candle.close >= candle.open ? '#2D9D83' : '#C45B5B'
            return <g key={candle.time}><line x1={x} x2={x} y1={scaleY(candle.high)} y2={scaleY(candle.low)} stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" /><rect x={x - Math.max(2, 380 / Math.max(data.length, 1))} y={bodyTop} width={Math.max(4, 760 / Math.max(data.length, 1))} height={bodyHeight} fill={color} rx="1" /></g>
          })}
        </svg>
      ) : (
      <div className="h-full w-full overflow-hidden"><ResponsiveContainer width="100%" height="100%">
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
            formatter={(value) => [formatPrice(Number(value ?? 0), ''), 'Price']}
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
      </ResponsiveContainer></div>
      )}
      </div>
    </div>
  )
}

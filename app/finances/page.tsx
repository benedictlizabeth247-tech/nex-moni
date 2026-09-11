"use client"

import { useEffect, useMemo, useState } from "react"
import { Activity, ArrowLeft, ChevronRight, CircleDollarSign, Layers, Search, ShieldCheck, Wallet, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { BottomNav } from "@/components/layout/BottomNav"
import { useLiveQuotes } from "@/hooks/use-market-data"
import { assetIconUrl, STOCK_UNIVERSE } from "@/services/market-data/symbols"
import { CandleChart } from "@/app/markets/[id]/candle-chart"
import type { Candle } from "@/services/market-data/types"
import { supabase } from "@/lib/supabase"
import { getTradingAccountSummary, type TradingAccountSummary } from "@/services/internalTradingService"

type Investor = { name: string; firm: string; category: string; logo: string; source: string; holdings: [string, string][] }

const firms: Investor[] = ([
  ["Bridgewater Associates", "Ray Dalio", "Institutional", "bridgewater.com", [["SPY", "SPDR S&P 500"], ["IEMG", "Emerging Markets"], ["GOOGL", "Alphabet"]]],
  ["Berkshire Hathaway", "Warren Buffett", "Institutional", "berkshirehathaway.com", [["AAPL", "Apple"], ["AXP", "American Express"], ["KO", "Coca-Cola"], ["BAC", "Bank of America"]]],
  ["Citadel", "Ken Griffin", "Hedge fund", "citadel.com", [["NVDA", "NVIDIA"], ["META", "Meta"], ["TSLA", "Tesla"], ["GOOGL", "Alphabet"]]],
  ["BlackRock", "Larry Fink", "Institutional", "blackrock.com", [["BLK", "BlackRock"], ["IVV", "Core S&P 500"], ["AGG", "Core Bond"]]],
  ["Pershing Square", "Bill Ackman", "Hedge fund", "pershingsquareholdings.com", [["CMG", "Chipotle"], ["GOOGL", "Alphabet"], ["HLT", "Hilton"]]],
  ["ARK Invest", "Cathie Wood", "Asset manager", "ark-invest.com", [["TSLA", "Tesla"], ["COIN", "Coinbase"], ["ROKU", "Roku"]]],
  ["Renaissance Technologies", "Jim Simons", "Hedge fund", "rentec.com", [["NVO", "Novo Nordisk"], ["LLY", "Eli Lilly"], ["MELI", "MercadoLibre"]]],
  ["Tiger Global", "Chase Coleman", "Hedge fund", "tigerglobal.com", [["MSFT", "Microsoft"], ["AMZN", "Amazon"], ["META", "Meta"]]],
  ["Coatue Management", "Philippe Laffont", "Hedge fund", "coatue.com", [["NVDA", "NVIDIA"], ["AMD", "AMD"], ["AMZN", "Amazon"]]],
  ["D.E. Shaw", "David Shaw", "Hedge fund", "deshaw.com", [["MSFT", "Microsoft"], ["AMZN", "Amazon"], ["V", "Visa"]]],
  ["Point72", "Steve Cohen", "Hedge fund", "point72.com", [["AMZN", "Amazon"], ["META", "Meta"], ["UBER", "Uber"]]],
  ["Tudor Investment", "Paul Tudor Jones", "Hedge fund", "tudorfunds.com", [["SPY", "SPDR S&P 500"], ["TLT", "Treasury Bond"], ["GLD", "Gold"]]],
  ["Adams Street Partners", "Investment team", "Private markets", "adamsstreetpartners.com", [["SPY", "SPDR S&P 500"], ["MSFT", "Microsoft"]]],
  ["Vanguard Group", "Tim Buckley", "Asset manager", "vanguard.com", [["VOO", "Vanguard S&P 500"], ["VTI", "Total Stock Market"], ["BND", "Total Bond"]]],
  ["State Street Global Advisors", "Ron O'Hanley", "Asset manager", "ssga.com", [["SPY", "SPDR S&P 500"], ["XLF", "Financial Select"], ["GLD", "Gold"]]],
  ["George Soros Fund", "George Soros", "Public filing", "soros.com", [["RIVN", "Rivian"], ["NFLX", "Netflix"], ["C", "Citigroup"]]],
  ["Donald J. Trump", "Public disclosure", "Public filing", "whitehouse.gov", [["DJT", "Trump Media"], ["BABA", "Alibaba"], ["AAPL", "Apple"]]],
  ["Nancy Pelosi", "Public disclosure", "Public filing", "clerk.house.gov", [["NVDA", "NVIDIA"], ["GOOGL", "Alphabet"], ["AAPL", "Apple"]]],
  ["Michael Bloomberg", "Public disclosure", "Public filing", "bloomberg.com", [["BLK", "BlackRock"], ["MSFT", "Microsoft"], ["AMZN", "Amazon"]]],
  ["UK Parliament Register", "Members' declarations", "Public filing", "members.parliament.uk", [["HSBA.L", "HSBC"], ["SHEL.L", "Shell"], ["AZN.L", "AstraZeneca"]]],
] as [string, string, string, string, [string, string][]][]).map(([firm, name, category, domain, holdings]) => ({ name, firm, category, logo: `https://www.google.com/s2/favicons?domain=${domain}&sz=128`, source: category === "Public filing" ? `https://${domain}` : `https://${domain}`, holdings }))

const steps = ["Investor", "Holdings", "Review", "Amount"]

export default function FinancesScreen() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [selected, setSelected] = useState<Investor | null>(null)
  const [query, setQuery] = useState("")
  const [amount, setAmount] = useState("")
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null)
  const [candles, setCandles] = useState<Candle[]>([])
  const [chartLoading, setChartLoading] = useState(false)
  const [balance, setBalance] = useState(0)
  const [accountSummary, setAccountSummary] = useState<TradingAccountSummary | null>(null)
  const [copyBusy, setCopyBusy] = useState(false)
  const [copyNotice, setCopyNotice] = useState("")
  useEffect(() => {
    let active = true
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const [{ data: wallet }, summary] = await Promise.all([
        supabase.from("wallets").select("available").eq("user_id", data.user.id).eq("currency", "USD").maybeSingle(),
        getTradingAccountSummary(),
      ])
      if (active) {
        setBalance(Number(wallet?.available ?? 0))
        setAccountSummary(summary)
      }
    })
    return () => { active = false }
  }, [])
  const symbols = STOCK_UNIVERSE.map(({ symbol }) => `stock.${symbol}`)
  const { quotes, isLoading, isOffline } = useLiveQuotes(symbols)
  const quoteBySymbol = useMemo(() => Object.fromEntries(Object.values(quotes).flatMap((quote) => { const symbol = quote.symbol.toUpperCase(); return [[symbol, quote], [`stock.${symbol}`, quote], [quote.id.toUpperCase(), quote]] })), [quotes])
  const visible = firms.filter((item) => `${item.name} ${item.firm} ${item.category}`.toLowerCase().includes(query.toLowerCase()))
  const holding = selected?.holdings.find(([symbol]) => symbol === selectedSymbol)
  const quote = selectedSymbol ? quoteBySymbol[selectedSymbol.toUpperCase()] ?? quoteBySymbol[`stock.${selectedSymbol.toUpperCase()}`] : null
  const entered = Number(amount || 0)
  const holdingRows = selected?.holdings.map(([symbol, name], index) => { const liveQuote = quoteBySymbol[symbol.toUpperCase()] ?? quoteBySymbol[`stock.${symbol.toUpperCase()}`]; const weight = [0.34, 0.27, 0.21, 0.18][index] ?? 0.1; const value = balance > 0 ? entered * weight : 0; const price = Number(liveQuote?.price ?? 0); return { symbol, name, weight, price, value, quantity: price > 0 ? value / price : 0, quote: liveQuote } }) ?? []
  const portfolioValue = holdingRows.reduce((total, row) => total + row.value, 0)
  const portfolioChange = holdingRows.reduce((total, row) => total + row.value * Number(row.quote?.changePercent ?? 0) / 100, 0)
  const selectInvestor = (investor: Investor) => { setSelected(investor); setStep(2) }
  const startCopyTrading = async () => {
    if (!selected || !entered || entered > balance) return
    setCopyBusy(true); setCopyNotice("")
    try {
      const portfolios = await fetch(`/api/finances/portfolios`, { cache: "no-store" }).then(r => r.json())
      const portfolio = (portfolios?.data ?? []).find((item: any) => String(item.name || "").toLowerCase().includes(String(selected.firm || selected.name).toLowerCase()) || String(item.description || "").toLowerCase().includes(String(selected.name).toLowerCase()))
      if (!portfolio?.id) throw new Error("This pilot is not connected to a live APEDAT portfolio yet.")
      const idempotencyKey = `copy-${portfolio.id}-${entered.toFixed(2)}-${selected.firm}-${selected.name}`.slice(0, 128)
      const response = await fetch("/api/finances/copy-trade", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ portfolioId: portfolio.id, amount: entered, idempotencyKey }) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || "Could not start copy trading.")
      const { data: refreshedWallet } = await supabase.from("wallets").select("available").eq("user_id", (await supabase.auth.getUser()).data.user?.id ?? "").eq("currency", "USD").maybeSingle()
      setCopyNotice(`Allocation started: $${entered.toFixed(2)} reserved from your USD wallet.`)
      setBalance(Number(refreshedWallet?.available ?? Math.max(0, balance - entered)))
    } catch (error) { setCopyNotice(error instanceof Error ? error.message : "Could not start copy trading.") }
    finally { setCopyBusy(false) }
  }
  const press = (key: string) => { if (key === "⌫") return setAmount((value) => value.slice(0, -1)); if (key === "." && amount.includes(".")) return; if (amount.includes(".") && amount.split(".")[1]?.length >= 2) return; setAmount((value) => `${value}${key}`.replace(/^0+(?=\d)/, "")) }
  const go = (next: number) => { if (next > 1 && !selected) return; setStep(next) }
  const openMarketOverview = async (symbol: string) => {
    setSelectedSymbol(symbol)
    setChartLoading(true)
    try {
      const response = await fetch(`/api/market/candles?id=${encodeURIComponent(symbol)}&timeframe=1D`, { cache: "no-store" })
      const data = await response.json()
      setCandles(data.series?.candles ?? [])
    } finally {
      setChartLoading(false)
    }
  }

  return <main className="min-h-screen bg-background pb-24 text-foreground"><header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/95 px-4 py-3 backdrop-blur"><button aria-label="Go back" onClick={() => router.back()} className="grid size-10 place-items-center rounded-xl border"><ArrowLeft size={18} /></button><div><h1 className="text-sm font-black tracking-tight">Finance / Market League</h1><p className="text-[10px] text-muted-foreground">Every market. One command center.</p></div><button aria-label="Open wallet" onClick={() => router.push("/wallet-details")} className="grid size-10 place-items-center rounded-xl border"><Wallet size={17} /></button></header><div className="mx-auto max-w-2xl space-y-4 px-4 py-5"><section className="relative overflow-hidden rounded-3xl border border-border/70 bg-card/90 p-5 shadow-sm backdrop-blur"><div className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full border border-primary/15"><div className="absolute inset-6 rounded-full border border-primary/10"><div className="absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/70" /></div></div><div className="relative flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Do justice to the market</p><h2 className="mt-2 max-w-[18rem] text-2xl font-black tracking-tight text-foreground">Your markets, working together.</h2><p className="mt-2 max-w-sm text-xs leading-5 text-muted-foreground">A unified command center for the assets shaping your portfolio.</p></div><div className="grid size-11 shrink-0 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary"><ShieldCheck size={21} /></div></div><div className="relative mt-5 grid grid-cols-3 gap-2"><div className="rounded-xl border border-border/60 bg-background/60 p-3"><CircleDollarSign size={15} className="text-primary" /><span className="mt-2 block text-[10px] text-muted-foreground">Account equity</span><strong className="mt-1 block text-sm">${Number(accountSummary?.equity ?? balance).toFixed(2)}</strong></div><div className="rounded-xl border border-border/60 bg-background/60 p-3"><Activity size={15} className="text-primary" /><span className="mt-2 block text-[10px] text-muted-foreground">24H P&L</span><strong className="mt-1 block text-sm">{Number(accountSummary?.unrealized_pnl ?? 0) >= 0 ? "+" : ""}{Number(accountSummary?.unrealized_pnl ?? 0).toFixed(2)}</strong></div><div className="rounded-xl border border-border/60 bg-background/60 p-3"><Layers size={15} className="text-primary" /><span className="mt-2 block text-[10px] text-muted-foreground">Available</span><strong className="mt-1 block text-sm">${Number(accountSummary?.available_margin ?? balance).toFixed(2)}</strong></div></div></section><section className="rounded-2xl border border-border/70 bg-card/90 p-4 shadow-sm backdrop-blur"><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">The market league</p><h2 className="mt-1 text-lg font-black">One platform. Many markets.</h2></div><span className="text-[10px] text-muted-foreground">Live feed</span></div><div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6"><div className="rounded-xl border border-primary/25 bg-primary/10 p-3"><CircleDollarSign size={17} className="text-primary" /><span className="mt-2 block text-[10px] font-semibold">Crypto</span></div><div className="rounded-xl border border-border/60 p-3"><Activity size={17} className="text-primary" /><span className="mt-2 block text-[10px] font-semibold">Stocks</span></div><div className="rounded-xl border border-border/60 p-3"><Layers size={17} className="text-primary" /><span className="mt-2 block text-[10px] font-semibold">ETFs</span></div><div className="rounded-xl border border-border/60 p-3"><ShieldCheck size={17} className="text-primary" /><span className="mt-2 block text-[10px] font-semibold">Metals</span></div><div className="rounded-xl border border-border/60 p-3"><CircleDollarSign size={17} className="text-primary" /><span className="mt-2 block text-[10px] font-semibold">Commodities</span></div><div className="rounded-xl border border-border/60 p-3"><Activity size={17} className="text-primary" /><span className="mt-2 block text-[10px] font-semibold">Forex</span></div></div></section><section className="rounded-2xl bg-primary p-5 text-primary-foreground shadow-sm"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#9FD9C0]">Copy trading</p><h2 className="mt-3 text-2xl font-black">{step === 4 ? "Choose an amount to invest" : step === 3 ? "Review this pilot" : step === 2 ? `${selected?.name}'s holdings` : "Pick a Pilot"}</h2><p className="mt-2 text-xs leading-5 text-white/70">{step === 4 ? `Available balance: $${balance.toFixed(2)}` : "Prices are supplied by the market feed. Public holdings show their filing source and date."}</p>{accountSummary && <div className="mt-4 grid grid-cols-3 gap-2 text-[10px]"><div className="rounded-lg bg-white/10 p-2"><span className="block text-white/60">Account equity</span><strong>${Number(accountSummary.equity).toFixed(2)}</strong></div><div className="rounded-lg bg-white/10 p-2"><span className="block text-white/60">Available</span><strong>${Number(accountSummary.available_margin).toFixed(2)}</strong></div><div className="rounded-lg bg-white/10 p-2"><span className="block text-white/60">Unrealized P&L</span><strong>{Number(accountSummary.unrealized_pnl) >= 0 ? "+" : ""}{Number(accountSummary.unrealized_pnl).toFixed(2)}</strong></div></div>}<div className="mt-5 grid grid-cols-4 gap-1 text-center text-[9px] font-bold">{steps.map((label, index) => <button key={label} type="button" onClick={() => go(index + 1)} className={`rounded p-2 ${step === index + 1 ? "bg-[#16A36A]" : "bg-white/10 hover:bg-white/20"}`}>{index + 1}<br />{label}</button>)}</div></section>{step === 1 && <section className="space-y-3"><div className="flex items-center gap-2 rounded-xl border px-3"><Search size={16} className="text-muted-foreground" /><input aria-label="Search investors" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search 20+ investors and firms" className="h-11 flex-1 bg-transparent text-xs outline-none" /></div>{visible.map((investor) => <button key={investor.name} type="button" onClick={() => selectInvestor(investor)} className="flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition hover:border-primary"><div className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-full border bg-[#17231F] text-[10px] font-black text-white"><img src={investor.logo} alt={`${investor.firm} logo`} className="size-full object-contain bg-white p-1" onError={(event) => { event.currentTarget.style.display = "none" }} /><span>{investor.firm.split(/\s+/).map((part) => part[0]).slice(0, 2).join("")}</span></div><span className="min-w-0 flex-1"><strong className="block text-sm">{investor.name}</strong><span className="block text-xs text-muted-foreground">{investor.firm} · {investor.category}</span><a href={investor.source} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} className="block text-[10px] text-muted-foreground underline underline-offset-2">Source: {investor.source.replace("https://", "")}</a></span><ChevronRight size={16} /></button>)}</section>}{step === 2 && selected && <section className="space-y-3"><div className="rounded-xl border p-4"><p className="text-xs font-semibold">Current portfolio value</p><p className="mt-1 text-2xl font-black">${portfolioValue.toFixed(2)}</p><p className="mt-1 text-[10px] text-muted-foreground">Current credits: ${balance.toFixed(2)} · Estimated session change: ${portfolioChange.toFixed(2)}</p><p className="mt-1 text-[10px] text-muted-foreground">Each holding is marked using the latest quote returned by the market feed. Filing ownership remains separately dated.</p></div>{holdingRows.map((row) => { const { symbol, name, price, quantity, value, quote: item } = row; return <button key={symbol} type="button" onClick={() => void openMarketOverview(symbol)} className="flex w-full items-center gap-3 rounded-2xl border p-3 text-left hover:border-primary"><div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full border bg-muted"><img src={assetIconUrl("stock", symbol) ?? ""} alt="" className="size-full object-contain" onError={(event) => { event.currentTarget.style.display = "none" }} /><span className="text-[10px] font-bold">{symbol.slice(0, 2)}</span></div><span className="flex-1"><strong className="block text-sm">{name}</strong><span className="text-[10px] text-muted-foreground">{symbol} · {isLoading ? "Updating price…" : item ? `${item.currency ?? "USD"} ${price.toFixed(2)} · ${Number(item.changePercent ?? 0).toFixed(2)}% · ${quantity.toFixed(4)} units · $${value.toFixed(2)} current value` : "Price unavailable / delayed"}</span></span><ChevronRight size={16} /></button>})}<button type="button" onClick={() => setStep(3)} className="w-full rounded-xl bg-[#16A36A] py-3 text-sm font-bold text-white">Review pilot</button></section>}{step === 3 && selected && <section className="space-y-3 rounded-2xl border p-5"><p className="text-xs text-muted-foreground">Source</p><p className="text-sm font-semibold">{selected.source}</p><p className="text-xs leading-5 text-muted-foreground">Verify the latest filing before relying on disclosed holdings. Public filings are not live portfolios.</p><button type="button" onClick={() => setStep(4)} className="w-full rounded-xl bg-[#16A36A] py-3 text-sm font-bold text-white">Choose amount</button></section>}{step === 4 && selected && <section className="space-y-4"><div className="rounded-2xl border p-6 text-center"><p className="text-4xl font-black">${amount || "0"}</p><p className="mt-2 text-xs text-muted-foreground">Available credits ${balance.toFixed(2)} · Portfolio value ${portfolioValue.toFixed(2)}</p><p className="mt-1 text-[10px] text-muted-foreground">{entered > balance ? "Add funds before starting a copy allocation." : "Enter an amount funded from your available balance."}</p></div><div className="grid grid-cols-3 gap-1 rounded-xl border p-1">{["1","2","3","4","5","6","7","8","9",".","0","⌫"].map((key) => <button key={key} type="button" onClick={() => press(key)} className="h-12 rounded-lg text-lg font-semibold hover:bg-muted">{key}</button>)}</div><button type="button" disabled={!entered || entered > balance || copyBusy} onClick={() => void startCopyTrading()} className="w-full rounded-xl bg-[#16A36A] py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{copyBusy ? "Starting…" : "Start copy trading"}</button>{copyNotice && <p className="text-center text-xs text-muted-foreground">{copyNotice}</p>}</section>}{selectedSymbol && <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 grid place-items-end bg-black/50 p-4"><div className="w-full max-w-lg rounded-2xl bg-background p-5"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">Market overview</p><h3 className="text-xl font-black">{holding?.[1]} ({selectedSymbol})</h3></div><button aria-label="Close market overview" onClick={() => setSelectedSymbol(null)}><X size={20} /></button></div><div className="mt-5 rounded-xl bg-muted p-5"><p className="text-3xl font-black">{quote ? `${quote.currency ?? "USD"} ${Number(quote.price).toFixed(2)}` : "Price unavailable"}</p><p className="mt-2 text-xs text-muted-foreground">{quote ? `Change ${Number(quote.changePercent ?? 0).toFixed(2)}% · ${quote.timestamp ? new Date(quote.timestamp).toLocaleString() : "live feed"}` : isOffline ? "Market provider is delayed or unavailable." : "Waiting for market feed."}</p>{chartLoading ? <p className="mt-4 text-xs text-muted-foreground">Loading market history…</p> : candles.length ? <CandleChart candles={candles} up={Number(quote?.changePercent ?? 0) >= 0} /> : <p className="mt-4 text-xs text-muted-foreground">Historical candles are unavailable from the market provider.</p>}</div><p className="mt-4 text-xs leading-5 text-muted-foreground">Quotes are market data, not investment advice. Confirm the provider timestamp before placing an order.</p></div></div>}</div><BottomNav /></main>
}

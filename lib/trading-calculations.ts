export const DEFAULT_TRADING_FEE_RATE = 0.001

export function calculateSpotQuantity(amountUsdt: number, executablePrice: number) {
  return amountUsdt > 0 && executablePrice > 0 ? amountUsdt / executablePrice : 0
}

export function calculateFuturesOrder(marginUsdt: number, leverage: number, executablePrice: number, feeRate = DEFAULT_TRADING_FEE_RATE) {
  const notionalUsdt = marginUsdt * leverage
  const quantity = calculateSpotQuantity(notionalUsdt, executablePrice)
  const estimatedFee = notionalUsdt * feeRate
  return { marginUsdt, leverage, notionalUsdt, quantity, estimatedFee, requiredBalance: marginUsdt + estimatedFee }
}

export function calculateSpotOrder(amountUsdt: number, executablePrice: number, feeRate = DEFAULT_TRADING_FEE_RATE) {
  const quantity = calculateSpotQuantity(amountUsdt, executablePrice)
  const estimatedFee = amountUsdt * feeRate
  return { amountUsdt, quantity, estimatedFee, requiredBalance: amountUsdt + estimatedFee }
}

export function formatQuantity(value: number) {
  return value.toLocaleString('en-US', { minimumFractionDigits: 8, maximumFractionDigits: 8 })
}

export function formatUsdt(value: number) {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

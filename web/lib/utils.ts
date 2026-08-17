import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Wallet amounts come back from the API as decimal strings (e.g. "10.50")
// so they never round-trip through a float - this only converts to a
// Number at the very last step, for display.
export function formatCurrency(amount: string | number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(Number(amount))
}

export function formatPercent(ratio: number, fractionDigits = 2) {
  return `${(ratio * 100).toFixed(fractionDigits)}%`
}

export function isoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

// Shared default window for date-range pickers (analytics, ad zone
// performance, campaign performance): the last `daysBack` days through today.
export function defaultDateRange(daysBack = 6) {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - daysBack)
  return { startDate: isoDate(start), endDate: isoDate(end) }
}

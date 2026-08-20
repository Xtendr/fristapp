export const COPENHAGEN_TIME_ZONE = "Europe/Copenhagen"

export type ExpiryBucket = "expired" | "today" | "tomorrow" | "soon" | "later"

export type CalendarDay = {
  year: number
  month: number
  day: number
}

const MS_PER_DAY = 86_400_000

export function parseYmd(value: string): CalendarDay {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) {
    throw new Error("Expiry date must be YYYY-MM-DD.")
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  if (!isRealCalendarDay(year, month, day)) {
    throw new Error("Expiry date is not a real calendar day.")
  }

  return { year, month, day }
}

export function formatYmd({ year, month, day }: CalendarDay): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

export function isRealCalendarDay(year: number, month: number, day: number) {
  const index = new Date(Date.UTC(year, month - 1, day))
  return (
    index.getUTCFullYear() === year &&
    index.getUTCMonth() === month - 1 &&
    index.getUTCDate() === day
  )
}

export function todayInCopenhagen(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: COPENHAGEN_TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(now)

  const year = Number(parts.find((part) => part.type === "year")?.value)
  const month = Number(parts.find((part) => part.type === "month")?.value)
  const day = Number(parts.find((part) => part.type === "day")?.value)

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    throw new Error("Could not resolve the current date in Europe/Copenhagen.")
  }

  return formatYmd({ year, month, day })
}

export function addCalendarDays(ymd: string, days: number): string {
  const { year, month, day } = parseYmd(ymd)
  const shifted = new Date(Date.UTC(year, month - 1, day + days))
  return formatYmd({
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  })
}

export function calendarDaysUntil(expiryYmd: string, todayYmd: string): number {
  return dayIndex(parseYmd(expiryYmd)) - dayIndex(parseYmd(todayYmd))
}

export function classifyExpiry(
  expiryYmd: string,
  now = new Date()
): ExpiryBucket {
  const days = calendarDaysUntil(expiryYmd, todayInCopenhagen(now))
  if (days < 0) {
    return "expired"
  }
  if (days === 0) {
    return "today"
  }
  if (days === 1) {
    return "tomorrow"
  }
  if (days <= 3) {
    return "soon"
  }
  return "later"
}

export function attentionUpperBound(now = new Date()): string {
  return addCalendarDays(todayInCopenhagen(now), 3)
}

export function relativeExpiryLabel(expiryYmd: string, now = new Date()): string {
  const days = calendarDaysUntil(expiryYmd, todayInCopenhagen(now))
  if (days < 0) {
    return "Expired"
  }
  if (days === 0) {
    return "Today"
  }
  if (days === 1) {
    return "Tomorrow"
  }
  return `${days} days`
}

export function formatDisplayDate(expiryYmd: string): string {
  const { year, month, day } = parseYmd(expiryYmd)
  return new Intl.DateTimeFormat("da-DK", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)))
}

export function storageLabel(value: "fridge" | "freezer" | "pantry"): string {
  if (value === "fridge") {
    return "Fridge"
  }
  if (value === "freezer") {
    return "Freezer"
  }
  return "Pantry"
}

function dayIndex({ year, month, day }: CalendarDay): number {
  return Date.UTC(year, month - 1, day) / MS_PER_DAY
}

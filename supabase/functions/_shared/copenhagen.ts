export const COPENHAGEN_TIME_ZONE = "Europe/Copenhagen"
export const DISPATCH_HOUR_COPENHAGEN = 8
export const REMINDER_OFFSETS = [0, 1, 3] as const

export type ReminderOffset = (typeof REMINDER_OFFSETS)[number]
export type CalendarDay = { year: number; month: number; day: number }

const MS_PER_DAY = 86_400_000

export function parseYmd(value: string): CalendarDay {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) {
    throw new Error("Expiry date must be YYYY-MM-DD.")
  }
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  }
}

export function formatYmd({ year, month, day }: CalendarDay): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
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

export function hourInCopenhagen(now = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: COPENHAGEN_TIME_ZONE,
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(now)

  const hour = Number(parts.find((part) => part.type === "hour")?.value)
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new Error("Could not resolve the current hour in Europe/Copenhagen.")
  }

  return hour
}

export function isCopenhagenDispatchHour(now = new Date()): boolean {
  return hourInCopenhagen(now) === DISPATCH_HOUR_COPENHAGEN
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

export function isReminderOffset(value: number): value is ReminderOffset {
  return value === 0 || value === 1 || value === 3
}

export function reminderCopy(displayName: string, offset: ReminderOffset) {
  if (offset === 0) {
    return { title: "Expires today", body: `${displayName} expires today` }
  }
  if (offset === 1) {
    return { title: "Use soon", body: `${displayName} expires tomorrow` }
  }
  return { title: "Use soon", body: `${displayName} expires in 3 days` }
}

function dayIndex({ year, month, day }: CalendarDay): number {
  return Date.UTC(year, month - 1, day) / MS_PER_DAY
}

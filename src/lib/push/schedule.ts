const COPENHAGEN_TIME_ZONE = "Europe/Copenhagen"

export const DISPATCH_HOUR_COPENHAGEN = 8

export const REMINDER_OFFSETS = [0, 1, 3] as const

export type ReminderOffset = (typeof REMINDER_OFFSETS)[number]

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

export function isReminderOffset(value: number): value is ReminderOffset {
  return value === 0 || value === 1 || value === 3
}

export function reminderCopy(
  displayName: string,
  offset: ReminderOffset
): { title: string; body: string } {
  if (offset === 0) {
    return {
      title: "Expires today",
      body: `${displayName} expires today`,
    }
  }

  if (offset === 1) {
    return {
      title: "Use soon",
      body: `${displayName} expires tomorrow`,
    }
  }

  return {
    title: "Use soon",
    body: `${displayName} expires in 3 days`,
  }
}

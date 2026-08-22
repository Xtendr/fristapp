export type ExpiryParseResult = {
  date: string | null
  yearSource: "visible" | "inferred" | "unknown"
  state: "confident" | "check" | "missing"
  rawMatch: string | null
  warnings: string[]
}

type Candidate = {
  day: number
  month: number
  year: number | null
  raw: string
  index: number
}

function validDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
}

function iso(year: number, month: number, day: number) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

function expandYear(value: number, currentYear: number) {
  if (value >= 1000) return value
  const century = Math.floor(currentYear / 100) * 100
  const candidate = century + value
  return candidate < currentYear - 20 ? candidate + 100 : candidate
}

function nearbyContext(text: string, candidate: Candidate) {
  return text.slice(Math.max(0, candidate.index - 24), candidate.index + candidate.raw.length + 24)
}

function productionOnlyContext(context: string) {
  const hasExpiry = /bedst|mindst|sidste|anvend|holdbar|use\s*by|best\s*before|exp(?:iry)?/i.test(context)
  const hasProduction = /prod(?:uktion|uceret)?|pakket|fremstillet|lot|batch|kode/i.test(context)
  return hasProduction && !hasExpiry
}

function collectCandidates(text: string): Candidate[] {
  const candidates: Candidate[] = []
  const occupied: Array<[number, number]> = []
  const add = (candidate: Candidate) => {
    const end = candidate.index + candidate.raw.length
    if (occupied.some(([start, stop]) => candidate.index < stop && end > start)) return
    occupied.push([candidate.index, end])
    candidates.push(candidate)
  }

  for (const match of text.matchAll(/\b(20\d{2})[.\/-](0?[1-9]|1[0-2])[.\/-](0?[1-9]|[12]\d|3[01])\b/g)) {
    add({ year: Number(match[1]), month: Number(match[2]), day: Number(match[3]), raw: match[0], index: match.index })
  }
  for (const match of text.matchAll(/\b(0?[1-9]|[12]\d|3[01])[.\/-](0?[1-9]|1[0-2])(?:[.\/-](\d{2}|20\d{2}))?\b/g)) {
    add({ day: Number(match[1]), month: Number(match[2]), year: match[3] ? Number(match[3]) : null, raw: match[0], index: match.index })
  }
  for (const match of text.matchAll(/\b(\d{2})(\d{2})(\d{2}|20\d{2})\b/g)) {
    add({ day: Number(match[1]), month: Number(match[2]), year: Number(match[3]), raw: match[0], index: match.index })
  }
  return candidates
}

export function parseDanishExpiryText(rawText: string, currentDate: string): ExpiryParseResult {
  const text = rawText.trim()
  const current = new Date(`${currentDate}T00:00:00Z`)
  if (!text || Number.isNaN(current.getTime())) {
    return { date: null, yearSource: "unknown", state: "missing", rawMatch: null, warnings: ["Couldn’t read the date"] }
  }

  const candidates = collectCandidates(text)
    .filter((candidate) => !productionOnlyContext(nearbyContext(text, candidate)))
    .flatMap((candidate) => {
      const year = candidate.year === null
        ? null
        : expandYear(candidate.year, current.getUTCFullYear())
      if (year !== null && !validDate(year, candidate.month, candidate.day)) return []
      if (year === null && !validDate(current.getUTCFullYear(), candidate.month, candidate.day)
        && !validDate(current.getUTCFullYear() + 1, candidate.month, candidate.day)) return []
      return [{ ...candidate, year }]
    })

  const resolved = candidates.map((candidate) => {
    if (candidate.year !== null) {
      return { candidate, date: iso(candidate.year, candidate.month, candidate.day), inferred: false }
    }
    let year = current.getUTCFullYear()
    let date = new Date(Date.UTC(year, candidate.month - 1, candidate.day))
    if (date.getTime() < current.getTime()) {
      year += 1
      date = new Date(Date.UTC(year, candidate.month - 1, candidate.day))
    }
    const days = Math.round((date.getTime() - current.getTime()) / 86_400_000)
    if (days < 0 || days > 370 || !validDate(year, candidate.month, candidate.day)) return null
    return { candidate, date: iso(year, candidate.month, candidate.day), inferred: true }
  }).filter((value): value is NonNullable<typeof value> => value !== null)

  const uniqueDates = [...new Set(resolved.map((value) => value.date))]
  if (uniqueDates.length !== 1) {
    return {
      date: null,
      yearSource: "unknown",
      state: uniqueDates.length > 1 ? "check" : "missing",
      rawMatch: null,
      warnings: [uniqueDates.length > 1 ? "More than one possible date was found" : "Couldn’t read the date"],
    }
  }

  const match = resolved.find((value) => value.date === uniqueDates[0])!
  return {
    date: match.date,
    yearSource: match.inferred ? "inferred" : "visible",
    state: match.inferred ? "check" : "confident",
    rawMatch: match.candidate.raw,
    warnings: match.inferred ? ["The year was inferred from today’s date"] : [],
  }
}

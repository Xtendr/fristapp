import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  addCalendarDays,
  calendarDaysUntil,
  classifyExpiry,
  todayInCopenhagen,
} from "./expiry.ts"

function atCopenhagen(isoUtc: string) {
  return new Date(isoUtc)
}

describe("todayInCopenhagen", () => {
  it("assembles YYYY-MM-DD from formatToParts, not locale format()", () => {
    assert.equal(
      todayInCopenhagen(atCopenhagen("2026-08-21T10:00:00.000Z")),
      "2026-08-21"
    )
  })

  it("stays on the Copenhagen calendar date around UTC midnight", () => {
    assert.equal(
      todayInCopenhagen(atCopenhagen("2026-08-20T22:30:00.000Z")),
      "2026-08-21"
    )
  })
})

describe("classifyExpiry buckets", () => {
  const now = atCopenhagen("2026-08-21T10:00:00.000Z")

  it("expired", () => {
    assert.equal(classifyExpiry("2026-08-20", now), "expired")
    assert.equal(classifyExpiry("2026-01-01", now), "expired")
  })

  it("today", () => {
    assert.equal(classifyExpiry("2026-08-21", now), "today")
  })

  it("tomorrow", () => {
    assert.equal(classifyExpiry("2026-08-22", now), "tomorrow")
  })

  it("soon is 2 or 3 calendar days", () => {
    assert.equal(classifyExpiry("2026-08-23", now), "soon")
    assert.equal(classifyExpiry("2026-08-24", now), "soon")
  })

  it("later is more than 3 calendar days", () => {
    assert.equal(classifyExpiry("2026-08-25", now), "later")
    assert.equal(classifyExpiry("2026-12-31", now), "later")
  })
})

describe("calendar boundaries", () => {
  it("month boundary", () => {
    const now = atCopenhagen("2026-08-31T12:00:00.000Z")
    assert.equal(todayInCopenhagen(now), "2026-08-31")
    assert.equal(classifyExpiry("2026-09-01", now), "tomorrow")
    assert.equal(addCalendarDays("2026-08-31", 3), "2026-09-03")
    assert.equal(calendarDaysUntil("2026-09-01", "2026-08-31"), 1)
  })

  it("year boundary", () => {
    const now = atCopenhagen("2026-12-31T12:00:00.000Z")
    assert.equal(todayInCopenhagen(now), "2026-12-31")
    assert.equal(classifyExpiry("2026-12-30", now), "expired")
    assert.equal(classifyExpiry("2027-01-01", now), "tomorrow")
    assert.equal(addCalendarDays("2026-12-31", 3), "2027-01-03")
    assert.equal(calendarDaysUntil("2027-01-02", "2026-12-31"), 2)
  })

  it("February non-leap month boundary", () => {
    const now = atCopenhagen("2026-02-28T12:00:00.000Z")
    assert.equal(classifyExpiry("2026-03-01", now), "tomorrow")
    assert.equal(addCalendarDays("2026-02-28", 1), "2026-03-01")
  })
})

describe("Europe/Copenhagen DST transitions", () => {
  it("spring forward 2026-03-29 does not shift the calendar day", () => {
    const lateWinter28 = atCopenhagen("2026-03-28T22:30:00.000Z")
    const early29 = atCopenhagen("2026-03-28T23:30:00.000Z")
    const beforeJump = atCopenhagen("2026-03-29T00:30:00.000Z")
    const afterJump = atCopenhagen("2026-03-29T01:30:00.000Z")

    assert.equal(todayInCopenhagen(lateWinter28), "2026-03-28")
    assert.equal(todayInCopenhagen(early29), "2026-03-29")
    assert.equal(todayInCopenhagen(beforeJump), "2026-03-29")
    assert.equal(todayInCopenhagen(afterJump), "2026-03-29")
    assert.equal(classifyExpiry("2026-03-29", afterJump), "today")
    assert.equal(classifyExpiry("2026-03-30", afterJump), "tomorrow")
    assert.equal(calendarDaysUntil("2026-03-30", "2026-03-29"), 1)
  })

  it("fall back 2026-10-25 does not shift the calendar day", () => {
    const late24 = atCopenhagen("2026-10-24T21:30:00.000Z")
    const early25 = atCopenhagen("2026-10-24T22:30:00.000Z")
    const firstTwoAm = atCopenhagen("2026-10-25T00:30:00.000Z")
    const repeatedTwoAm = atCopenhagen("2026-10-25T01:30:00.000Z")

    assert.equal(todayInCopenhagen(late24), "2026-10-24")
    assert.equal(todayInCopenhagen(early25), "2026-10-25")
    assert.equal(todayInCopenhagen(firstTwoAm), "2026-10-25")
    assert.equal(todayInCopenhagen(repeatedTwoAm), "2026-10-25")
    assert.equal(classifyExpiry("2026-10-24", repeatedTwoAm), "expired")
    assert.equal(classifyExpiry("2026-10-26", repeatedTwoAm), "tomorrow")
    assert.equal(calendarDaysUntil("2026-10-28", "2026-10-25"), 3)
  })
})

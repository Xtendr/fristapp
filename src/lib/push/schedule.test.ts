import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  hourInCopenhagen,
  isCopenhagenDispatchHour,
  isReminderOffset,
  reminderCopy,
} from "./schedule.ts"

describe("hourInCopenhagen", () => {
  it("is 08:00 CEST in summer at 06:00 UTC", () => {
    assert.equal(hourInCopenhagen(new Date("2026-08-20T06:00:00.000Z")), 8)
    assert.equal(isCopenhagenDispatchHour(new Date("2026-08-20T06:00:00.000Z")), true)
  })

  it("is 08:00 CET in winter at 07:00 UTC", () => {
    assert.equal(hourInCopenhagen(new Date("2026-01-15T07:00:00.000Z")), 8)
    assert.equal(isCopenhagenDispatchHour(new Date("2026-01-15T07:00:00.000Z")), true)
  })

  it("does not dispatch in adjacent Copenhagen hours", () => {
    assert.equal(isCopenhagenDispatchHour(new Date("2026-08-20T05:00:00.000Z")), false)
    assert.equal(isCopenhagenDispatchHour(new Date("2026-08-20T07:00:00.000Z")), false)
    assert.equal(hourInCopenhagen(new Date("2026-01-15T06:00:00.000Z")), 7)
  })
})

describe("reminder offsets and copy", () => {
  it("accepts only 0, 1, and 3", () => {
    assert.equal(isReminderOffset(0), true)
    assert.equal(isReminderOffset(1), true)
    assert.equal(isReminderOffset(3), true)
    assert.equal(isReminderOffset(2), false)
    assert.equal(isReminderOffset(-1), false)
  })

  it("keeps server-owned notification copy", () => {
    assert.deepEqual(reminderCopy("Letmælk", 0), {
      title: "Expires today",
      body: "Letmælk expires today",
    })
    assert.deepEqual(reminderCopy("Letmælk", 1), {
      title: "Use soon",
      body: "Letmælk expires tomorrow",
    })
    assert.deepEqual(reminderCopy("Letmælk", 3), {
      title: "Use soon",
      body: "Letmælk expires in 3 days",
    })
  })
})

import assert from "node:assert/strict"
import { parseDanishExpiryText } from "../supabase/functions/_shared/danish-expiry.ts"

const today = "2026-08-22"

for (const [raw, expected] of [
  ["Bedst før 24.08.2026", "2026-08-24"],
  ["Mindst holdbar til 24-08-26", "2026-08-24"],
  ["Anvendes senest 24/08/2026", "2026-08-24"],
  ["EXP 240826", "2026-08-24"],
]) assert.equal(parseDanishExpiryText(raw, today).date, expected, raw)

const inferred = parseDanishExpiryText("Bedst før 03.01", today)
assert.equal(inferred.date, "2027-01-03")
assert.equal(inferred.state, "check")
assert.equal(inferred.yearSource, "inferred")

const ambiguous = parseDanishExpiryText("Bedst før 24.08.2026 / 25.08.2026", today)
assert.equal(ambiguous.date, null)
assert.equal(ambiguous.state, "check")

assert.equal(parseDanishExpiryText("Produceret 21.08.2026 LOT 431", today).date, null)
assert.equal(parseDanishExpiryText("Bedst før 31.02.2027", today).date, null)

console.log("Danish expiry parser tests passed")

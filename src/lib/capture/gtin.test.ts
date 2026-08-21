import assert from "node:assert/strict"
import test from "node:test"

import { normalizeGtin } from "./gtin.ts"

test("keeps a valid EAN-13", () => {
  assert.deepEqual(normalizeGtin("4006381333931", "EAN_13"), {
    success: true,
    gtin: "4006381333931",
  })
})

test("normalizes UPC-A to a 13-digit GTIN", () => {
  assert.deepEqual(normalizeGtin("036000291452", "UPC_A"), {
    success: true,
    gtin: "0036000291452",
  })
})

test("keeps a valid EAN-8", () => {
  assert.deepEqual(normalizeGtin("96385074", "EAN_8"), {
    success: true,
    gtin: "96385074",
  })
})

test("expands UPC-E to a 13-digit GTIN", () => {
  assert.deepEqual(normalizeGtin("04252614", "UPC_E"), {
    success: true,
    gtin: "0042100005264",
  })
})

test("rejects an invalid check digit", () => {
  assert.equal(normalizeGtin("4006381333932").success, false)
})

test("rejects unsupported characters", () => {
  assert.equal(normalizeGtin("4006-ABCD").success, false)
})

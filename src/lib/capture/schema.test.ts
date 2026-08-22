import assert from "node:assert/strict"
import test from "node:test"

import { captureProposalSchema, confirmedCaptureItemsSchema } from "./schema.ts"

const analysis = {
  provider: "mistral" as const,
  model: "ministral-14b-2512",
  promptVersion: "dk-capture-v2",
  latencyMs: 420,
  tokenUsage: { prompt: 100, completion: 50, total: 150 },
  responseStatus: "ok" as const,
}

test("accepts additive structured capture metadata", () => {
  const result = captureProposalSchema.safeParse({
    displayName: "Letmælk",
    expiryDate: "2026-08-25",
    expiryType: "best_before",
    storageLocation: "fridge",
    quantity: 1,
    gtin: "05701234567890",
    categoryKey: "dairy_eggs",
    rawProductText: "LET MÆLK",
    rawExpiryText: "Bedst før 25.08.26",
    expiryYearSource: "visible",
    fieldState: {
      displayName: "confident",
      expiryDate: "confident",
      category: "confident",
      storageLocation: "check",
    },
    warnings: [],
    provenance: "photos",
    confidence: { product: 0.9, expiry: 0.95 },
    notes: [],
    analysis,
  })
  assert.equal(result.success, true)
})

test("rejects invalid metadata and confirmed categories", () => {
  const proposal = captureProposalSchema.safeParse({
    displayName: "Milk",
    expiryDate: "25/08/2026",
    storageLocation: "fridge",
    quantity: 1,
    gtin: null,
    confidence: { product: 2, expiry: -1 },
  })
  assert.equal(proposal.success, false)

  const confirmed = confirmedCaptureItemsSchema.safeParse([{
    captureItemId: "11111111-1111-4111-8111-111111111111",
    displayName: "Milk",
    expiryDate: "2026-08-25",
    expiryType: "unknown",
    storageLocation: "fridge",
    quantity: 1,
    categoryId: "not-a-category-id",
  }])
  assert.equal(confirmed.success, false)
})

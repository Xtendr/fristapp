import { z } from "zod"

import { inventoryItemSchema } from "../inventory/schema.ts"

export const captureModeSchema = z.enum(["photo", "batch"])

export const captureProposalSchema = z.object({
  displayName: z.string().trim().max(80).default(""),
  expiryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .default(null),
  storageLocation: z.enum(["fridge", "freezer", "pantry"]).default("fridge"),
  quantity: z.number().int().min(1).max(99).default(1),
  gtin: z.string().regex(/^\d{8,14}$/).nullable().default(null),
  expiryType: z.enum(["best_before", "use_by", "unknown"]).default("unknown"),
  categoryKey: z.enum([
    "dairy_eggs", "fruit_vegetables", "meat_fish", "bread_bakery",
    "meals_leftovers", "drinks", "pantry_staples", "condiments",
    "snacks", "other",
  ]).nullable().default(null),
  rawProductText: z.string().max(1200).default(""),
  rawExpiryText: z.string().max(1200).default(""),
  expiryYearSource: z.enum(["visible", "inferred", "unknown"]).default("unknown"),
  fieldState: z.object({
    displayName: z.enum(["confident", "check", "missing"]),
    expiryDate: z.enum(["confident", "check", "missing"]),
    category: z.enum(["confident", "check", "missing"]),
    storageLocation: z.enum(["confident", "check", "missing"]),
  }).default({ displayName: "missing", expiryDate: "missing", category: "missing", storageLocation: "check" }),
  warnings: z.array(z.string().max(180)).max(8).default([]),
  provenance: z.enum(["photos", "saved_product", "manual"]).default("photos"),
  confidence: z.object({
    product: z.number().min(0).max(1),
    expiry: z.number().min(0).max(1),
  }),
  notes: z.array(z.string().max(160)).max(6).default([]),
  analysis: z.object({
    provider: z.literal("mistral"),
    model: z.string().max(80),
    promptVersion: z.string().max(40),
    latencyMs: z.number().int().nonnegative(),
    tokenUsage: z.object({
      prompt: z.number().int().nonnegative().nullable(),
      completion: z.number().int().nonnegative().nullable(),
      total: z.number().int().nonnegative().nullable(),
    }),
    responseStatus: z.enum(["ok", "invalid", "unavailable"]),
  }).optional(),
})

export const confirmedCaptureItemSchema = inventoryItemSchema.extend({
  captureItemId: z.string().uuid(),
  productId: z.string().uuid().nullable().optional(),
})

export const confirmedCaptureItemsSchema = z
  .array(confirmedCaptureItemSchema)
  .min(1)
  .max(50)

export type CaptureMode = z.infer<typeof captureModeSchema>
export type CaptureProposal = z.infer<typeof captureProposalSchema>
export type ConfirmedCaptureItem = z.infer<typeof confirmedCaptureItemSchema>

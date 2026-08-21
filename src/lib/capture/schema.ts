import { z } from "zod"

import { inventoryItemSchema } from "@/lib/inventory/schema"

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
  confidence: z.object({
    product: z.number().min(0).max(1),
    expiry: z.number().min(0).max(1),
  }),
  notes: z.array(z.string().max(160)).max(6).default([]),
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

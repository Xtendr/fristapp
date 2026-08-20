import { z } from "zod"

import { isRealCalendarDay } from "@/lib/inventory/expiry"

export const storageLocations = ["fridge", "freezer", "pantry"] as const

export const inventoryItemSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Enter a product name.")
    .max(80, "Use 80 characters or fewer."),
  expiryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter an expiry date.")
    .refine((value) => {
      const [year, month, day] = value.split("-").map(Number)
      return isRealCalendarDay(year, month, day)
    }, "Enter a real calendar date."),
  storageLocation: z.enum(storageLocations, {
    message: "Choose fridge, freezer, or pantry.",
  }),
  quantity: z.coerce
    .number()
    .int("Quantity must be a whole number.")
    .min(1, "Quantity must be at least 1.")
    .max(99, "Quantity must be 99 or fewer."),
})

export type InventoryItemInput = z.infer<typeof inventoryItemSchema>

export function parseInventoryForm(formData: FormData) {
  return inventoryItemSchema.safeParse({
    displayName: String(formData.get("displayName") ?? ""),
    expiryDate: String(formData.get("expiryDate") ?? ""),
    storageLocation: String(formData.get("storageLocation") ?? ""),
    quantity: String(formData.get("quantity") ?? "1"),
  })
}

"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { publicErrorMessage } from "@/lib/auth/errors"
import { getSessionHousehold } from "@/lib/household/session"
import { inventoryCreateContextSchema, parseInventoryForm } from "@/lib/inventory/schema"
import { createClient } from "@/lib/supabase/server"

async function requireReadyHousehold(): Promise<
  { error: string } | { householdId: string }
> {
  const session = await getSessionHousehold()
  if (!session.userId || session.household.status !== "ready") {
    return { error: "Household is missing." }
  }
  return { householdId: session.household.current.householdId }
}

function revalidateInventory() {
  revalidatePath("/", "layout")
  revalidatePath("/inventory")
  revalidatePath("/add")
}

export async function createInventoryItem(
  formData: FormData
): Promise<{ error: string } | { added: string }> {
  const household = await requireReadyHousehold()
  if ("error" in household) {
    return household
  }

  const parsed = parseInventoryForm(formData)
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check the form and try again.",
    }
  }

  const context = inventoryCreateContextSchema.safeParse({
    source: String(formData.get("source") ?? "manual"),
    productId: formData.get("productId")
      ? String(formData.get("productId"))
      : null,
  })
  if (!context.success) return { error: "Capture information is invalid." }

  const supabase = await createClient()
  const { error } = await supabase.from("inventory_items").insert({
    household_id: household.householdId,
    display_name: parsed.data.displayName,
    expiry_date: parsed.data.expiryDate,
    storage_location: parsed.data.storageLocation,
    quantity: parsed.data.quantity,
    source: context.data.source,
    product_id: context.data.productId ?? null,
  })

  if (error) {
    return { error: publicErrorMessage(error) }
  }

  revalidateInventory()
  return { added: parsed.data.displayName }
}

export async function updateInventoryItem(
  itemId: string,
  formData: FormData
): Promise<{ error: string } | void> {
  const household = await requireReadyHousehold()
  if ("error" in household) {
    return household
  }

  const parsed = parseInventoryForm(formData)
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check the form and try again.",
    }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from("inventory_items")
    .update({
      display_name: parsed.data.displayName,
      expiry_date: parsed.data.expiryDate,
      storage_location: parsed.data.storageLocation,
      quantity: parsed.data.quantity,
    })
    .eq("id", itemId)
    .eq("household_id", household.householdId)

  if (error) {
    return { error: publicErrorMessage(error) }
  }

  revalidateInventory()
  redirect("/inventory")
}

export async function deleteInventoryItem(
  itemId: string
): Promise<{ error: string } | void> {
  const household = await requireReadyHousehold()
  if ("error" in household) {
    return household
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from("inventory_items")
    .delete()
    .eq("id", itemId)
    .eq("household_id", household.householdId)

  if (error) {
    return { error: publicErrorMessage(error) }
  }

  revalidateInventory()
  redirect("/inventory")
}

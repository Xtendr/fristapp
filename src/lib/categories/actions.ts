"use server"

import { z } from "zod"

import { publicErrorMessage } from "@/lib/auth/errors"
import { getSessionHousehold } from "@/lib/household/session"
import type { CategoryIconKey } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"

const categoryInput = z.object({
  name: z.string().trim().min(1, "Enter a category name.").max(32, "Use 32 characters or fewer."),
  iconKey: z.enum(["milk", "apple", "drumstick", "wheat", "utensils", "cup", "package", "bottle", "cookie", "shapes"]),
})

async function readyHousehold() {
  const session = await getSessionHousehold()
  return session.userId && session.household.status === "ready" ? session.household.current : null
}

export async function createCategory(name: string, iconKey: CategoryIconKey) {
  const household = await readyHousehold()
  if (!household) return { error: "Household is missing." }
  const parsed = categoryInput.safeParse({ name, iconKey })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the category." }
  const supabase = await createClient()
  const { error } = await supabase.rpc("create_household_category", {
    p_household_id: household.householdId,
    p_name: parsed.data.name,
    p_icon_key: parsed.data.iconKey,
  })
  return error ? { error: publicErrorMessage(error) } : { saved: true as const }
}

export async function updateCategory(categoryId: string, name: string, iconKey: CategoryIconKey) {
  const parsed = categoryInput.safeParse({ name, iconKey })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the category." }
  const supabase = await createClient()
  const { error } = await supabase.rpc("update_household_category", {
    p_category_id: categoryId,
    p_name: parsed.data.name,
    p_icon_key: parsed.data.iconKey,
  })
  return error ? { error: publicErrorMessage(error) } : { saved: true as const }
}

export async function reorderCategories(categoryIds: string[]) {
  const household = await readyHousehold()
  if (!household) return { error: "Household is missing." }
  const supabase = await createClient()
  const { error } = await supabase.rpc("reorder_household_categories", {
    p_household_id: household.householdId,
    p_category_ids: categoryIds,
  })
  return error ? { error: publicErrorMessage(error) } : { saved: true as const }
}

export async function archiveCategory(categoryId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("archive_household_category", { p_category_id: categoryId })
  return error ? { error: publicErrorMessage(error) } : { reassigned: data }
}

export async function applyCategoryAssignments(assignments: Array<{ itemId: string; categoryId: string }>) {
  const household = await readyHousehold()
  if (!household) return { error: "Household is missing." }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("apply_category_assignments", {
    p_household_id: household.householdId,
    p_assignments: assignments,
  })
  return error ? { error: publicErrorMessage(error) } : { updated: data }
}

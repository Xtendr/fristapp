import { attentionUpperBound } from "@/lib/inventory/expiry"
import { mapInventoryItem, type InventoryItem } from "@/lib/inventory/item"
import { createClient } from "@/lib/supabase/server"

export type { InventoryItem }

async function listInventory(householdId: string, untilDate?: string) {
  const supabase = await createClient()
  let query = supabase
    .from("inventory_items")
    .select("id, display_name, quantity, expiry_date, storage_location")
    .eq("household_id", householdId)
    .order("expiry_date", { ascending: true })
    .order("created_at", { ascending: true })

  if (untilDate) {
    query = query.lte("expiry_date", untilDate)
  }

  const { data, error } = await query
  if (error || !data) {
    return []
  }

  return data.map(mapInventoryItem)
}

export async function getHouseholdInventory(householdId: string) {
  return listInventory(householdId)
}

export async function getAttentionInventory(householdId: string) {
  return listInventory(householdId, attentionUpperBound())
}

export async function getInventoryItem(householdId: string, itemId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("inventory_items")
    .select("id, display_name, quantity, expiry_date, storage_location")
    .eq("household_id", householdId)
    .eq("id", itemId)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return mapInventoryItem(data)
}

import { attentionUpperBound } from "@/lib/inventory/expiry"
import { createClient } from "@/lib/supabase/server"
import type { StorageLocation } from "@/lib/supabase/database.types"

export type InventoryItem = {
  id: string
  displayName: string
  quantity: number
  expiryDate: string
  storageLocation: StorageLocation
}

function mapRow(row: {
  id: string
  display_name: string
  quantity: number
  expiry_date: string
  storage_location: StorageLocation
}): InventoryItem {
  return {
    id: row.id,
    displayName: row.display_name,
    quantity: row.quantity,
    expiryDate: row.expiry_date,
    storageLocation: row.storage_location,
  }
}

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

  return data.map(mapRow)
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

  return mapRow(data)
}

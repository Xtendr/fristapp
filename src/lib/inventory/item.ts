import type { StorageLocation } from "@/lib/supabase/database.types"

export type InventoryItem = {
  id: string
  displayName: string
  quantity: number
  expiryDate: string
  storageLocation: StorageLocation
}

export function mapInventoryItem(row: {
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

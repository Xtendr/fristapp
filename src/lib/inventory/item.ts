import type {
  CategoryIconKey,
  ExpiryType,
  StorageLocation,
} from "@/lib/supabase/database.types"

export type InventoryItem = {
  id: string
  displayName: string
  quantity: number
  expiryDate: string
  expiryType?: ExpiryType
  storageLocation: StorageLocation
  productId?: string | null
  category?: {
    id: string
    name: string
    iconKey: CategoryIconKey
  }
  addedBy?: {
    id: string
    name: string
  }
}

export function mapInventoryItem(row: {
  id: string
  display_name: string
  quantity: number
  expiry_date: string
  expiry_type: ExpiryType
  storage_location: StorageLocation
  product_id: string | null
  category_id: string
  household_categories:
    | { name: string; icon_key: CategoryIconKey }
    | { name: string; icon_key: CategoryIconKey }[]
  added_by: string
  profiles:
    | { display_name: string }
    | { display_name: string }[]
}): InventoryItem {
  const category = Array.isArray(row.household_categories)
    ? row.household_categories[0]
    : row.household_categories
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
  return {
    id: row.id,
    displayName: row.display_name,
    quantity: row.quantity,
    expiryDate: row.expiry_date,
    expiryType: row.expiry_type,
    storageLocation: row.storage_location,
    productId: row.product_id,
    category: {
      id: row.category_id,
      name: category?.name ?? "Other",
      iconKey: category?.icon_key ?? "shapes",
    },
    addedBy: {
      id: row.added_by,
      name: profile?.display_name ?? "Household member",
    },
  }
}

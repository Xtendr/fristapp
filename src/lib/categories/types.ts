import type {
  CategoryIconKey,
  CategorySystemKey,
} from "@/lib/supabase/database.types"

export type HouseholdCategory = {
  id: string
  name: string
  systemKey: CategorySystemKey | null
  iconKey: CategoryIconKey
  sortOrder: number
  archivedAt: string | null
}

export type CategorySuggestion = {
  itemId: string
  categoryId: string
  reason: string | null
}

export function mapHouseholdCategory(row: {
  id: string
  name: string
  system_key: CategorySystemKey | null
  icon_key: CategoryIconKey
  sort_order: number
  archived_at: string | null
}): HouseholdCategory {
  return {
    id: row.id,
    name: row.name,
    systemKey: row.system_key,
    iconKey: row.icon_key,
    sortOrder: row.sort_order,
    archivedAt: row.archived_at,
  }
}

export function otherCategory(categories: HouseholdCategory[]) {
  return categories.find((category) => category.systemKey === "other") ?? categories[0]
}

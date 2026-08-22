import { createClient } from "@/lib/supabase/client"

export type InventoryCategorySuggestion = {
  itemId: string
  categoryId: string
  categoryName: string
  reason: string | null
}

export async function suggestInventoryCategories(householdId: string) {
  const supabase = createClient()
  const { data, error } = await supabase.functions.invoke("classify-inventory", { body: { householdId } })
  if (error || data?.status !== "review") throw new Error(data?.message ?? "Items could not be organized right now.")
  return (data.suggestions ?? []) as InventoryCategorySuggestion[]
}

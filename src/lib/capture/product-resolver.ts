import { createClient } from "@/lib/supabase/client"
import type { CategorySystemKey, StorageLocation } from "@/lib/supabase/database.types"

export type ResolvedProduct = {
  id: string
  gtin: string
  displayName: string
  brand: string | null
  variant: string | null
  packageSize: string | null
  imageUrl: string | null
  source: "open_food_facts" | "user_confirmed"
  categoryKey: CategorySystemKey | null
}

export type ProductPreference = {
  categoryId: string
  storageLocation: StorageLocation
  source: "household" | "product_cache" | "open_food_facts"
}

export type ProductLookupResult =
  | { status: "found"; product: ResolvedProduct; preference: ProductPreference | null }
  | { status: "not_found" }
  | { status: "unavailable" | "invalid"; message: string }

export async function lookupProduct(
  gtin: string,
  householdId: string
): Promise<ProductLookupResult> {
  const supabase = createClient()
  const { data, error } = await supabase.functions.invoke("product-resolver", {
    body: { operation: "lookup", gtin, householdId, locale: navigator.language },
  })
  if (error) return { status: "unavailable", message: "Online product lookup is unavailable." }
  return data as ProductLookupResult
}

export async function confirmProduct(
  gtin: string,
  displayName: string
): Promise<ResolvedProduct | null> {
  const supabase = createClient()
  const { data, error } = await supabase.functions.invoke("product-resolver", {
    body: {
      operation: "confirm",
      gtin,
      locale: navigator.language,
      product: { displayName },
    },
  })
  if (error || data?.status !== "found") return null
  return data.product as ResolvedProduct
}

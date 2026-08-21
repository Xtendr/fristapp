import { createClient } from "@/lib/supabase/client"

export type ResolvedProduct = {
  id: string
  gtin: string
  displayName: string
  brand: string | null
  variant: string | null
  packageSize: string | null
  imageUrl: string | null
  source: "open_food_facts" | "user_confirmed"
}

export type ProductLookupResult =
  | { status: "found"; product: ResolvedProduct }
  | { status: "not_found" }
  | { status: "unavailable" | "invalid"; message: string }

export async function lookupProduct(gtin: string): Promise<ProductLookupResult> {
  const supabase = createClient()
  const { data, error } = await supabase.functions.invoke("product-resolver", {
    body: { operation: "lookup", gtin, locale: navigator.language },
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

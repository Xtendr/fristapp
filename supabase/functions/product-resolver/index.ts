import { createClient } from "npm:@supabase/supabase-js@2"

type ProductRecord = {
  id: string
  gtin: string
  display_name: string
  brand: string | null
  variant: string | null
  package_size: string | null
  image_url: string | null
  locale: string | null
  source: "open_food_facts" | "user_confirmed"
  last_refreshed_at: string
}

type ProductInput = {
  displayName?: unknown
  brand?: unknown
  variant?: unknown
  packageSize?: unknown
  imageUrl?: unknown
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

function bearerToken(req: Request): string | null {
  const match = /^Bearer\s+(.+)$/i.exec(req.headers.get("Authorization")?.trim() ?? "")
  return match?.[1]?.trim() || null
}

function cleanOptional(value: unknown, maximum: number): string | null {
  if (typeof value !== "string") return null
  const cleaned = value.trim()
  return cleaned ? cleaned.slice(0, maximum) : null
}

function publicProduct(product: ProductRecord) {
  return {
    id: product.id,
    gtin: product.gtin,
    displayName: product.display_name,
    brand: product.brand,
    variant: product.variant,
    packageSize: product.package_size,
    imageUrl: product.image_url,
    source: product.source,
  }
}

function isFresh(product: ProductRecord): boolean {
  if (product.source === "user_confirmed") return true
  return Date.now() - new Date(product.last_refreshed_at).getTime() < 30 * 24 * 60 * 60 * 1000
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") return json(405, { status: "invalid", message: "POST required." })

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!supabaseUrl || !serviceRoleKey) {
    return json(503, { status: "unavailable", message: "Product lookup is not configured." })
  }

  const token = bearerToken(req)
  if (!token) return json(401, { status: "invalid", message: "Authentication required." })

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: authData, error: authError } = await admin.auth.getUser(token)
  if (authError || !authData.user) {
    return json(401, { status: "invalid", message: "Your session has expired." })
  }

  let body: { operation?: unknown; gtin?: unknown; locale?: unknown; product?: ProductInput }
  try {
    body = await req.json()
  } catch {
    return json(400, { status: "invalid", message: "Invalid request." })
  }

  const gtin = typeof body.gtin === "string" ? body.gtin.trim() : ""
  if (!/^\d{8,14}$/.test(gtin)) {
    return json(400, { status: "invalid", message: "Invalid GTIN." })
  }
  const locale = cleanOptional(body.locale, 16) ?? "da-DK"

  if (body.operation === "confirm") {
    const displayName = cleanOptional(body.product?.displayName, 120)
    if (!displayName) {
      return json(400, { status: "invalid", message: "A product name is required." })
    }

    const { data, error } = await admin
      .from("products")
      .upsert(
        {
          gtin,
          display_name: displayName,
          brand: cleanOptional(body.product?.brand, 120),
          variant: cleanOptional(body.product?.variant, 120),
          package_size: cleanOptional(body.product?.packageSize, 80),
          image_url: cleanOptional(body.product?.imageUrl, 500),
          locale,
          source: "user_confirmed",
          last_refreshed_at: new Date().toISOString(),
        },
        { onConflict: "gtin" }
      )
      .select("id, gtin, display_name, brand, variant, package_size, image_url, locale, source, last_refreshed_at")
      .single<ProductRecord>()

    if (error || !data) return json(503, { status: "unavailable", message: "Product could not be saved." })
    return json(200, { status: "found", product: publicProduct(data) })
  }

  if (body.operation !== "lookup") {
    return json(400, { status: "invalid", message: "Unknown operation." })
  }

  const { data: cached } = await admin
    .from("products")
    .select("id, gtin, display_name, brand, variant, package_size, image_url, locale, source, last_refreshed_at")
    .eq("gtin", gtin)
    .maybeSingle<ProductRecord>()

  if (cached && isFresh(cached)) {
    return json(200, { status: "found", product: publicProduct(cached), cache: "hit" })
  }

  const userAgent = Deno.env.get("OPEN_FOOD_FACTS_USER_AGENT")
  if (!userAgent) {
    return cached
      ? json(200, { status: "found", product: publicProduct(cached), cache: "stale" })
      : json(503, { status: "unavailable", message: "Online product lookup is not configured." })
  }

  let response: Response
  try {
    const fields = "code,product_name,product_name_da,product_name_en,brands,quantity,image_front_url"
    response = await fetch(
      `https://world.openfoodfacts.org/api/v3/product/${encodeURIComponent(gtin)}?fields=${fields}`,
      { headers: { "User-Agent": userAgent, Accept: "application/json" } }
    )
  } catch {
    return cached
      ? json(200, { status: "found", product: publicProduct(cached), cache: "stale" })
      : json(503, { status: "unavailable", message: "Product lookup is temporarily unavailable." })
  }

  if (response.status === 404) return json(200, { status: "not_found" })
  if (!response.ok) {
    return cached
      ? json(200, { status: "found", product: publicProduct(cached), cache: "stale" })
      : json(503, { status: "unavailable", message: "Product lookup is temporarily unavailable." })
  }

  const payload = await response.json()
  const offProduct = payload?.product
  const displayName = [
    offProduct?.product_name_da,
    offProduct?.product_name,
    offProduct?.product_name_en,
  ].map((name) => cleanOptional(name, 120)).find(Boolean) ?? null
  if (!displayName) return json(200, { status: "not_found" })

  const record = {
    gtin,
    display_name: displayName,
    brand: cleanOptional(offProduct?.brands, 120),
    variant: null,
    package_size: cleanOptional(offProduct?.quantity, 80),
    image_url: cleanOptional(offProduct?.image_front_url, 500),
    locale,
    source: "open_food_facts" as const,
    last_refreshed_at: new Date().toISOString(),
  }
  const { data, error } = await admin
    .from("products")
    .upsert(record, { onConflict: "gtin" })
    .select("id, gtin, display_name, brand, variant, package_size, image_url, locale, source, last_refreshed_at")
    .single<ProductRecord>()

  if (error || !data) return json(503, { status: "unavailable", message: "Product could not be cached." })
  return json(200, { status: "found", product: publicProduct(data), cache: "miss" })
})

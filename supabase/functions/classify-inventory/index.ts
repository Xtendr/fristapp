import { createClient } from "npm:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } })
}

function token(req: Request) {
  return /^Bearer\s+(.+)$/i.exec(req.headers.get("Authorization")?.trim() ?? "")?.[1] ?? null
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") return json(405, { status: "invalid" })
  const url = Deno.env.get("SUPABASE_URL")
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  const mistralKey = Deno.env.get("MISTRAL_API_KEY")
  const model = Deno.env.get("MISTRAL_MODEL") ?? "ministral-14b-2512"
  if (!url || !serviceKey || !mistralKey) return json(503, { status: "unavailable", message: "Organization assistance is unavailable." })
  const bearer = token(req)
  if (!bearer) return json(401, { status: "invalid" })
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: authData } = await admin.auth.getUser(bearer)
  if (!authData.user) return json(401, { status: "invalid" })
  const body = await req.json().catch(() => ({}))
  const householdId = typeof body.householdId === "string" ? body.householdId : ""
  const { data: owner } = await admin.from("household_members").select("user_id").eq("household_id", householdId).eq("user_id", authData.user.id).eq("role", "owner").maybeSingle()
  if (!owner) return json(403, { status: "invalid", message: "Only an owner can organize items." })

  const { data: categories } = await admin.from("household_categories").select("id, name, system_key").eq("household_id", householdId).is("archived_at", null).order("sort_order")
  const other = categories?.find((category) => category.system_key === "other")
  if (!other) return json(409, { status: "invalid", message: "Other category is missing." })
  const { data: items } = await admin.from("inventory_items").select("id, display_name, products(display_name, brand, category_key)").eq("household_id", householdId).eq("category_id", other.id).limit(200)
  if (!items?.length) return json(200, { status: "review", suggestions: [] })

  const allowed = (categories ?? []).filter((category) => category.system_key).map((category) => ({ key: category.system_key, name: category.name }))
  const tool = {
    type: "function",
    function: {
      name: "submit_category_assignments",
      description: "Suggest one allowed category for each household food item.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["assignments"],
        properties: {
          assignments: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["itemId", "categoryKey", "reason"],
              properties: {
                itemId: { type: "string" },
                categoryKey: { type: "string", enum: allowed.map((category) => category.key) },
                reason: { type: "string" },
              },
            },
          },
        },
      },
    },
  }
  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${mistralKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 1400,
      tools: [tool],
      tool_choice: "any",
      messages: [{ role: "user", content: `Categorize these food items using only the allowed keys. Do not invent categories. Keep Other when uncertain. Allowed: ${JSON.stringify(allowed)}. Items: ${JSON.stringify(items)}` }],
    }),
  })
  if (!response.ok) return json(503, { status: "unavailable", message: "Organization assistance is unavailable." })
  const result = await response.json()
  const raw = result?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw
  const itemIds = new Set(items.map((item) => item.id))
  const categoriesByKey = new Map((categories ?? []).map((category) => [category.system_key, category]))
  const suggestions = Array.isArray(parsed?.assignments) ? parsed.assignments.flatMap((assignment: Record<string, unknown>) => {
    const category = categoriesByKey.get(String(assignment.categoryKey))
    if (!itemIds.has(String(assignment.itemId)) || !category) return []
    return [{ itemId: String(assignment.itemId), categoryId: category.id, categoryName: category.name, reason: typeof assignment.reason === "string" ? assignment.reason.slice(0, 140) : null }]
  }) : []
  return json(200, { status: "review", suggestions })
})

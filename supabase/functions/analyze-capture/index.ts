import { createClient } from "npm:@supabase/supabase-js@2"

import { parseDanishExpiryText } from "../_shared/danish-expiry.ts"

const PROMPT_VERSION = "dk-capture-v2"
const CATEGORY_KEYS = [
  "dairy_eggs", "fruit_vegetables", "meat_fish", "bread_bakery",
  "meals_leftovers", "drinks", "pantry_staples", "condiments",
  "snacks", "other",
] as const
type CategoryKey = typeof CATEGORY_KEYS[number]
type FieldState = "confident" | "check" | "missing"

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

function base64(bytes: Uint8Array): string {
  let binary = ""
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

async function imageChunk(
  admin: ReturnType<typeof createClient>,
  path: string,
  kind: "product" | "expiry",
) {
  const { data, error } = await admin.storage.from("capture-images").download(path)
  if (error || !data) throw new Error("capture_image_missing")
  const maxBytes = kind === "expiry" ? 4 * 1024 * 1024 : 2 * 1024 * 1024
  if (data.size > maxBytes) throw new Error("capture_image_too_large")
  const mime = data.type === "image/webp" ? "image/webp" : "image/jpeg"
  const bytes = new Uint8Array(await data.arrayBuffer())
  return { type: "image_url", image_url: `data:${mime};base64,${base64(bytes)}` }
}

function copenhagenDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Copenhagen",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ""
  return `${get("year")}-${get("month")}-${get("day")}`
}

function cleanText(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : ""
}

function cleanState(value: unknown, fallback: FieldState): FieldState {
  return value === "confident" || value === "check" || value === "missing" ? value : fallback
}

function cleanProposal(
  value: unknown,
  today: string,
  allowedCategoryKeys: Set<string>,
  analysis: Record<string, unknown>,
) {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {}
  const fieldState = input.fieldState && typeof input.fieldState === "object"
    ? input.fieldState as Record<string, unknown>
    : {}
  const rawProductText = cleanText(input.rawProductText, 1200)
  const rawExpiryText = cleanText(input.rawExpiryText, 1200)
  const displayName = cleanText(input.displayName, 80)
  const parsedExpiry = parseDanishExpiryText(rawExpiryText, today)
  const proposedExpiry = typeof input.expiryDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.expiryDate)
    ? input.expiryDate
    : null
  const warnings = Array.isArray(input.warnings)
    ? input.warnings.filter((warning) => typeof warning === "string").slice(0, 6).map((warning) => warning.slice(0, 180))
    : []

  let expiryDate = parsedExpiry.date
  let expiryState = parsedExpiry.state
  if (proposedExpiry && parsedExpiry.date && proposedExpiry !== parsedExpiry.date) {
    expiryDate = null
    expiryState = "check"
    warnings.push("The visible date and proposed date did not agree")
  } else if (proposedExpiry && !parsedExpiry.date) {
    expiryDate = null
    expiryState = parsedExpiry.state === "missing" ? "missing" : "check"
  }
  warnings.push(...parsedExpiry.warnings)

  const categoryKey = typeof input.categoryKey === "string"
    && CATEGORY_KEYS.includes(input.categoryKey as CategoryKey)
    && allowedCategoryKeys.has(input.categoryKey)
    ? input.categoryKey as CategoryKey
    : allowedCategoryKeys.has("other") ? "other" : null
  const storage = ["fridge", "freezer", "pantry"].includes(String(input.storageLocation))
    ? String(input.storageLocation)
    : "fridge"
  const expiryType = ["best_before", "use_by", "unknown"].includes(String(input.expiryType))
    ? String(input.expiryType)
    : "unknown"
  const gtin = typeof input.gtin === "string" && /^\d{8,14}$/.test(input.gtin) ? input.gtin : null
  const quantity = Number(input.quantity)

  return {
    displayName,
    expiryDate,
    expiryType,
    storageLocation: storage,
    quantity: Number.isInteger(quantity) && quantity >= 1 && quantity <= 99 ? quantity : 1,
    gtin,
    categoryKey,
    rawProductText,
    rawExpiryText,
    expiryYearSource: parsedExpiry.yearSource,
    fieldState: {
      displayName: displayName ? cleanState(fieldState.displayName, "check") : "missing",
      expiryDate: expiryState,
      category: categoryKey && categoryKey !== "other" ? cleanState(fieldState.category, "check") : "check",
      storageLocation: cleanState(fieldState.storageLocation, "check"),
    },
    warnings: [...new Set(warnings)].slice(0, 8),
    provenance: "photos",
    confidence: {
      product: cleanState(fieldState.displayName, "check") === "confident" ? 0.9 : displayName ? 0.5 : 0,
      expiry: expiryState === "confident" ? 0.95 : expiryState === "check" ? 0.5 : 0,
    },
    notes: [],
    analysis,
  }
}

const analysisTool = {
  type: "function",
  function: {
    name: "submit_capture_analysis",
    description: "Return visible food product and expiry information for user review.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["displayName", "expiryDate", "expiryType", "storageLocation", "quantity", "gtin", "categoryKey", "rawProductText", "rawExpiryText", "fieldState", "warnings"],
      properties: {
        displayName: { type: "string" },
        expiryDate: { anyOf: [{ type: "string" }, { type: "null" }] },
        expiryType: { type: "string", enum: ["best_before", "use_by", "unknown"] },
        storageLocation: { type: "string", enum: ["fridge", "freezer", "pantry"] },
        quantity: { type: "integer", minimum: 1, maximum: 99 },
        gtin: { anyOf: [{ type: "string" }, { type: "null" }] },
        categoryKey: { anyOf: [{ type: "string", enum: CATEGORY_KEYS }, { type: "null" }] },
        rawProductText: { type: "string", description: "Exact useful text visible in the product image." },
        rawExpiryText: { type: "string", description: "Exact date and nearby wording visible in the expiry image." },
        fieldState: {
          type: "object",
          additionalProperties: false,
          required: ["displayName", "expiryDate", "category", "storageLocation"],
          properties: {
            displayName: { type: "string", enum: ["confident", "check", "missing"] },
            expiryDate: { type: "string", enum: ["confident", "check", "missing"] },
            category: { type: "string", enum: ["confident", "check", "missing"] },
            storageLocation: { type: "string", enum: ["confident", "check", "missing"] },
          },
        },
        warnings: { type: "array", items: { type: "string" }, maxItems: 6 },
      },
    },
  },
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") return json(405, { status: "invalid", message: "POST required." })

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  const mistralKey = Deno.env.get("MISTRAL_API_KEY")
  const model = Deno.env.get("MISTRAL_MODEL") ?? "ministral-14b-2512"
  if (!supabaseUrl || !serviceRoleKey) return json(503, { status: "unavailable", code: "capture_unavailable" })

  const token = bearerToken(req)
  if (!token) return json(401, { status: "invalid", message: "Authentication required." })
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: authData, error: authError } = await admin.auth.getUser(token)
  if (authError || !authData.user) return json(401, { status: "invalid", message: "Your session has expired." })
  if (!mistralKey) return json(503, { status: "unavailable", code: "ai_unavailable", message: "Photo assistance is unavailable. Review this item manually." })

  let body: { captureItemId?: unknown }
  try { body = await req.json() } catch { return json(400, { status: "invalid", message: "Invalid request." }) }
  const captureItemId = typeof body.captureItemId === "string" ? body.captureItemId : ""
  if (!/^[0-9a-f-]{36}$/i.test(captureItemId)) return json(400, { status: "invalid", message: "Invalid capture item." })

  const { data: item } = await admin
    .from("capture_items")
    .select("id, session_id, product_image_path, expiry_image_path, capture_sessions!inner(household_id, created_by, expires_at)")
    .eq("id", captureItemId)
    .maybeSingle()
  const session = Array.isArray(item?.capture_sessions) ? item.capture_sessions[0] : item?.capture_sessions
  if (!item || !session || session.created_by !== authData.user.id || new Date(session.expires_at).getTime() <= Date.now()) {
    return json(404, { status: "invalid", message: "Capture item is unavailable." })
  }
  const [{ data: membership }, { data: categories }] = await Promise.all([
    admin.from("household_members").select("user_id").eq("household_id", session.household_id).eq("user_id", authData.user.id).maybeSingle(),
    admin.from("household_categories").select("name, system_key").eq("household_id", session.household_id).is("archived_at", null).order("sort_order"),
  ])
  if (!membership) return json(403, { status: "invalid", message: "Household access is missing." })
  if (!item.product_image_path && !item.expiry_image_path) return json(400, { status: "invalid", message: "Add at least one photo." })

  const startedAt = Date.now()
  await admin.from("capture_items").update({ status: "processing", error_code: null }).eq("id", item.id)
  await admin.from("capture_sessions").update({ status: "processing" }).eq("id", item.session_id)

  try {
    const today = copenhagenDate()
    const allowedCategories = (categories ?? []).filter((category) => category.system_key).map((category) => `${category.system_key}: ${category.name}`)
    const content: Array<Record<string, unknown>> = [{
      type: "text",
      text: [
        `Today in Copenhagen is ${today}.`,
        "Read one household food item for a review form. Never invent unreadable text.",
        "Danish expiry terms include 'bedst før', 'mindst holdbar til', 'sidste anvendelsesdato' and 'anvendes senest'.",
        "Distinguish expiry dates from production dates, packing dates, lot numbers and batch codes.",
        "Danish dates may use dots, dashes, slashes, compact digits, two-digit years, or omit the year.",
        "Copy the exact useful product text and exact expiry text into the raw fields.",
        `Suggest only one of these existing category keys: ${allowedCategories.join(", ")}.`,
        "Use missing when text is unreadable and check whenever there is ambiguity. The server validates the date independently.",
      ].join(" "),
    }]
    if (item.product_image_path) {
      content.push({ type: "text", text: "PRODUCT IMAGE — identify the food, package text and barcode only." })
      content.push(await imageChunk(admin, item.product_image_path, "product"))
    }
    if (item.expiry_image_path) {
      content.push({ type: "text", text: "EXPIRY IMAGE — read the expiry wording and date exactly; ignore production and lot codes." })
      content.push(await imageChunk(admin, item.expiry_image_path, "expiry"))
    }

    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${mistralKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages: [{ role: "user", content }], tools: [analysisTool], tool_choice: "any", temperature: 0, max_tokens: 900 }),
    })
    if (!response.ok) {
      const analysisMetadata = { provider: "mistral", model, promptVersion: PROMPT_VERSION, latencyMs: Date.now() - startedAt, tokenUsage: { prompt: null, completion: null, total: null }, responseStatus: "unavailable", httpStatus: response.status }
      await admin.from("capture_items").update({ status: "failed", error_code: "ai_unavailable", analysis_metadata: analysisMetadata }).eq("id", item.id)
      await admin.from("capture_sessions").update({ status: "review" }).eq("id", item.session_id)
      return json(503, { status: "unavailable", code: "ai_unavailable", message: "Photo assistance is unavailable. Review this item manually." })
    }

    const result = await response.json()
    const message = result?.choices?.[0]?.message
    const argumentsValue = message?.tool_calls?.[0]?.function?.arguments
    const parsed = typeof argumentsValue === "string"
      ? JSON.parse(argumentsValue)
      : argumentsValue ?? (typeof message?.content === "string" ? JSON.parse(message.content) : message?.content)
    const analysisMetadata = {
      provider: "mistral",
      model,
      promptVersion: PROMPT_VERSION,
      latencyMs: Date.now() - startedAt,
      tokenUsage: {
        prompt: Number.isInteger(result?.usage?.prompt_tokens) ? result.usage.prompt_tokens : null,
        completion: Number.isInteger(result?.usage?.completion_tokens) ? result.usage.completion_tokens : null,
        total: Number.isInteger(result?.usage?.total_tokens) ? result.usage.total_tokens : null,
      },
      responseStatus: "ok",
      ocrFallbackEnabled: Deno.env.get("EXPIRY_OCR_FALLBACK_ENABLED") === "true",
    }
    const categoryKeys = (categories ?? [])
      .map((category) => category.system_key)
      .filter((key): key is string => typeof key === "string")
    const proposal = cleanProposal(parsed, today, new Set(categoryKeys), analysisMetadata)

    await admin.from("capture_items").update({ status: "review", proposal, analysis_metadata: analysisMetadata, error_code: null }).eq("id", item.id)
    await admin.from("capture_sessions").update({ status: "review" }).eq("id", item.session_id)
    return json(200, { status: "review", proposal })
  } catch (error) {
    const code = error instanceof Error && error.message.startsWith("capture_image_") ? error.message : "ai_invalid_response"
    const analysisMetadata = { provider: "mistral", model, promptVersion: PROMPT_VERSION, latencyMs: Date.now() - startedAt, tokenUsage: { prompt: null, completion: null, total: null }, responseStatus: "invalid" }
    await admin.from("capture_items").update({ status: "failed", error_code: code, analysis_metadata: analysisMetadata }).eq("id", item.id)
    await admin.from("capture_sessions").update({ status: "review" }).eq("id", item.session_id)
    return json(503, { status: "unavailable", code, message: "The photos could not be read. Review this item manually." })
  }
})

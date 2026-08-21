import { createClient } from "npm:@supabase/supabase-js@2"

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

async function imageChunk(admin: ReturnType<typeof createClient>, path: string) {
  const { data, error } = await admin.storage.from("capture-images").download(path)
  if (error || !data) throw new Error("capture_image_missing")
  if (data.size > 2 * 1024 * 1024) throw new Error("capture_image_too_large")
  const mime = data.type === "image/webp" ? "image/webp" : "image/jpeg"
  const bytes = new Uint8Array(await data.arrayBuffer())
  return { type: "image_url", image_url: `data:${mime};base64,${base64(bytes)}` }
}

function cleanProposal(value: unknown) {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {}
  const confidence = input.confidence && typeof input.confidence === "object"
    ? input.confidence as Record<string, unknown>
    : {}
  const storage = ["fridge", "freezer", "pantry"].includes(String(input.storageLocation))
    ? String(input.storageLocation)
    : "fridge"
  const expiry = typeof input.expiryDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.expiryDate)
    ? input.expiryDate
    : null
  const gtin = typeof input.gtin === "string" && /^\d{8,14}$/.test(input.gtin)
    ? input.gtin
    : null
  const number = Number(input.quantity)
  const notes = Array.isArray(input.notes)
    ? input.notes.filter((note) => typeof note === "string").slice(0, 6).map((note) => note.slice(0, 160))
    : []

  return {
    displayName: typeof input.displayName === "string" ? input.displayName.trim().slice(0, 80) : "",
    expiryDate: expiry,
    storageLocation: storage,
    quantity: Number.isInteger(number) && number >= 1 && number <= 99 ? number : 1,
    gtin,
    confidence: {
      product: Math.min(1, Math.max(0, Number(confidence.product) || 0)),
      expiry: Math.min(1, Math.max(0, Number(confidence.expiry) || 0)),
    },
    notes,
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") return json(405, { status: "invalid", message: "POST required." })

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  const mistralKey = Deno.env.get("MISTRAL_API_KEY")
  const model = Deno.env.get("MISTRAL_MODEL") ?? "ministral-14b-2512"
  if (!supabaseUrl || !serviceRoleKey) {
    return json(503, { status: "unavailable", code: "capture_unavailable" })
  }

  const token = bearerToken(req)
  if (!token) return json(401, { status: "invalid", message: "Authentication required." })
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: authData, error: authError } = await admin.auth.getUser(token)
  if (authError || !authData.user) return json(401, { status: "invalid", message: "Your session has expired." })
  if (!mistralKey) {
    return json(503, { status: "unavailable", code: "ai_unavailable", message: "AI capture is not configured. Add this item manually." })
  }

  let body: { captureItemId?: unknown }
  try {
    body = await req.json()
  } catch {
    return json(400, { status: "invalid", message: "Invalid request." })
  }
  const captureItemId = typeof body.captureItemId === "string" ? body.captureItemId : ""
  if (!/^[0-9a-f-]{36}$/i.test(captureItemId)) return json(400, { status: "invalid", message: "Invalid capture item." })

  const { data: item } = await admin
    .from("capture_items")
    .select("id, session_id, product_image_path, expiry_image_path, capture_sessions!inner(household_id, created_by, status, expires_at)")
    .eq("id", captureItemId)
    .maybeSingle()
  const session = Array.isArray(item?.capture_sessions) ? item?.capture_sessions[0] : item?.capture_sessions
  if (!item || !session || session.created_by !== authData.user.id || new Date(session.expires_at).getTime() <= Date.now()) {
    return json(404, { status: "invalid", message: "Capture item is unavailable." })
  }
  const { data: membership } = await admin
    .from("household_members")
    .select("user_id")
    .eq("household_id", session.household_id)
    .eq("user_id", authData.user.id)
    .maybeSingle()
  if (!membership) return json(403, { status: "invalid", message: "Household access is missing." })
  if (!item.product_image_path && !item.expiry_image_path) {
    return json(400, { status: "invalid", message: "Add at least one photo." })
  }

  await admin.from("capture_items").update({ status: "processing", error_code: null }).eq("id", item.id)
  await admin.from("capture_sessions").update({ status: "processing" }).eq("id", item.session_id)

  try {
    const content: Array<Record<string, unknown>> = [{
      type: "text",
      text: [
        "Analyze these household food photos and return one JSON object only.",
        "The first photo is normally the product; the second is normally the expiry label.",
        "Never invent unreadable facts. Use null for an unreadable expiry date or barcode.",
        "Infer storageLocation conservatively as fridge, freezer, or pantry.",
        "Shape: {displayName:string, expiryDate:string|null (YYYY-MM-DD), storageLocation:string, quantity:integer, gtin:string|null, confidence:{product:number,expiry:number}, notes:string[]}.",
      ].join(" "),
    }]
    if (item.product_image_path) content.push(await imageChunk(admin, item.product_image_path))
    if (item.expiry_image_path) content.push(await imageChunk(admin, item.expiry_image_path))

    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${mistralKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content }],
        response_format: { type: "json_object" },
        temperature: 0,
        max_tokens: 500,
      }),
    })

    if (!response.ok) {
      await admin.from("capture_items").update({ status: "failed", error_code: "ai_unavailable" }).eq("id", item.id)
      await admin.from("capture_sessions").update({ status: "draft" }).eq("id", item.session_id)
      return json(503, { status: "unavailable", code: "ai_unavailable", message: "AI capture is unavailable. Review this item manually." })
    }

    const result = await response.json()
    const contentValue = result?.choices?.[0]?.message?.content
    const parsed = typeof contentValue === "string" ? JSON.parse(contentValue) : contentValue
    const proposal = cleanProposal(parsed)

    await admin.from("capture_items").update({ status: "review", proposal, error_code: null }).eq("id", item.id)
    await admin.from("capture_sessions").update({ status: "review" }).eq("id", item.session_id)
    return json(200, { status: "review", proposal })
  } catch (error) {
    const code = error instanceof Error && error.message.startsWith("capture_image_")
      ? error.message
      : "ai_invalid_response"
    await admin.from("capture_items").update({ status: "failed", error_code: code }).eq("id", item.id)
    await admin.from("capture_sessions").update({ status: "draft" }).eq("id", item.session_id)
    return json(503, { status: "unavailable", code, message: "The photos could not be analyzed. Review this item manually." })
  }
})

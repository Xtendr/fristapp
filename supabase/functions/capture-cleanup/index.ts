import { createClient } from "npm:@supabase/supabase-js@2"

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function timingSafeEqual(left: string, right: string) {
  const a = new TextEncoder().encode(left)
  const b = new TextEncoder().encode(right)
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let index = 0; index < a.length; index++) mismatch |= a[index] ^ b[index]
  return mismatch === 0
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "POST required." })
  const url = Deno.env.get("SUPABASE_URL")
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  const cronSecret = Deno.env.get("CRON_SECRET")
  const supplied = req.headers.get("x-cron-secret") ?? ""
  if (!url || !key || !cronSecret || !timingSafeEqual(supplied, cronSecret)) {
    return json(401, { error: "Unauthorized." })
  }

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const committedBefore = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: expired } = await admin
    .from("capture_sessions")
    .select("id, capture_items(product_image_path, expiry_image_path)")
    .or(`expires_at.lt.${new Date().toISOString()},and(status.eq.committed,committed_at.lt.${committedBefore})`)
    .limit(100)

  let removedSessions = 0
  let removedImages = 0
  for (const session of expired ?? []) {
    const paths = (session.capture_items ?? [])
      .flatMap((item: { product_image_path: string | null; expiry_image_path: string | null }) => [item.product_image_path, item.expiry_image_path])
      .filter((path: string | null): path is string => Boolean(path))
    if (paths.length) {
      const { error } = await admin.storage.from("capture-images").remove(paths)
      if (error) continue
      removedImages += paths.length
    }
    const { error } = await admin.from("capture_sessions").delete().eq("id", session.id)
    if (!error) removedSessions += 1
  }

  return json(200, { removedSessions, removedImages })
})

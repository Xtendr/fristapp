import { prepareCaptureImage } from "@/lib/capture/image"
import { captureProposalSchema, type CaptureMode, type CaptureProposal, type ConfirmedCaptureItem } from "@/lib/capture/schema"
import { normalizeGtin } from "@/lib/capture/gtin"
import { lookupProduct } from "@/lib/capture/product-resolver"
import { createClient } from "@/lib/supabase/client"

export type CaptureFiles = {
  product: File | null
  expiry: File | null
}

export type PreparedCaptureItem = {
  id: string
  position: number
  proposal: CaptureProposal
  productId: string | null
  usedFallback: boolean
}

const fallbackProposal: CaptureProposal = {
  displayName: "",
  expiryDate: null,
  storageLocation: "fridge",
  quantity: 1,
  gtin: null,
  confidence: { product: 0, expiry: 0 },
  notes: ["Review the photos and enter the details manually."],
}

async function uploadImage(path: string, file: File) {
  const supabase = createClient()
  const blob = await prepareCaptureImage(file)
  const { error } = await supabase.storage
    .from("capture-images")
    .upload(path, blob, { contentType: blob.type, upsert: false })
  if (error) throw new Error("A photo could not be uploaded.")
}

export async function prepareCapture(
  householdId: string,
  userId: string,
  mode: CaptureMode,
  rows: CaptureFiles[]
): Promise<{ sessionId: string; items: PreparedCaptureItem[] }> {
  const usableRows = rows.filter((row) => row.product || row.expiry)
  if (!usableRows.length) throw new Error("Add at least one photo.")

  const supabase = createClient()
  const { data: session, error: sessionError } = await supabase
    .from("capture_sessions")
    .insert({ household_id: householdId, mode })
    .select("id")
    .single()
  if (sessionError || !session) throw new Error("A capture session could not be started.")

  const uploaded: Array<{ id: string; position: number }> = []
  for (const [position, row] of usableRows.entries()) {
    const { data: item, error: itemError } = await supabase
      .from("capture_items")
      .insert({ session_id: session.id, position })
      .select("id")
      .single()
    if (itemError || !item) throw new Error("A capture item could not be created.")

    const base = `${userId}/${session.id}/${item.id}`
    const productPath = row.product ? `${base}/product.webp` : null
    const expiryPath = row.expiry ? `${base}/expiry.webp` : null
    if (row.product && productPath) await uploadImage(productPath, row.product)
    if (row.expiry && expiryPath) await uploadImage(expiryPath, row.expiry)

    const { error: pathError } = await supabase
      .from("capture_items")
      .update({ product_image_path: productPath, expiry_image_path: expiryPath })
      .eq("id", item.id)
    if (pathError) throw new Error("The uploaded photos could not be attached.")

    uploaded.push({ id: item.id, position })
  }

  const prepared: PreparedCaptureItem[] = []
  for (const item of uploaded) {
    const { data, error } = await supabase.functions.invoke("analyze-capture", {
      body: { captureItemId: item.id },
    })
    const parsed = !error && data?.status === "review"
      ? captureProposalSchema.safeParse(data.proposal)
      : null
    const proposal = parsed?.success ? parsed.data : fallbackProposal
    const normalizedGtin = proposal.gtin ? normalizeGtin(proposal.gtin) : null
    const lookup = normalizedGtin?.success
      ? await lookupProduct(normalizedGtin.gtin)
      : null
    const resolvedProduct = lookup?.status === "found" ? lookup.product : null
    prepared.push({
      id: item.id,
      position: item.position,
      proposal: {
        ...proposal,
        displayName: resolvedProduct?.displayName ?? proposal.displayName,
        gtin: normalizedGtin?.success ? normalizedGtin.gtin : null,
      },
      productId: resolvedProduct?.id ?? null,
      usedFallback: !parsed?.success,
    })
  }

  return { sessionId: session.id, items: prepared }
}

export async function loadPendingCapture(
  householdId: string,
  mode: CaptureMode
): Promise<{ sessionId: string; items: PreparedCaptureItem[] } | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("capture_sessions")
    .select("id, capture_items(id, position, proposal)")
    .eq("household_id", householdId)
    .eq("mode", mode)
    .in("status", ["draft", "review"])
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error || !data?.capture_items?.length) return null

  const items = data.capture_items
    .sort((left, right) => left.position - right.position)
    .map((item) => {
      const parsed = captureProposalSchema.safeParse(item.proposal)
      return {
        id: item.id,
        position: item.position,
        proposal: parsed.success ? parsed.data : fallbackProposal,
        productId: null,
        usedFallback: !parsed.success,
      }
    })

  return { sessionId: data.id, items }
}

export async function discardCapture(sessionId: string): Promise<void> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("capture_items")
    .select("product_image_path, expiry_image_path")
    .eq("session_id", sessionId)
  if (error) throw new Error("The capture could not be discarded.")
  const paths = (data ?? [])
    .flatMap((item) => [item.product_image_path, item.expiry_image_path])
    .filter((path): path is string => Boolean(path))
  if (paths.length) {
    const removed = await supabase.storage.from("capture-images").remove(paths)
    if (removed.error) throw new Error("The capture photos could not be removed.")
  }
  const removedSession = await supabase
    .from("capture_sessions")
    .delete()
    .eq("id", sessionId)
  if (removedSession.error) throw new Error("The capture could not be discarded.")
}

export async function commitCapture(
  sessionId: string,
  items: ConfirmedCaptureItem[]
): Promise<number> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("commit_capture_session", {
    p_session_id: sessionId,
    p_confirmed_items: items,
  })
  if (error) throw new Error("The capture could not be saved. Check every item and try again.")
  return data
}

import { prepareCaptureImage } from "@/lib/capture/image"
import { captureProposalSchema, type CaptureMode, type CaptureProposal, type ConfirmedCaptureItem } from "@/lib/capture/schema"
import { normalizeGtin } from "@/lib/capture/gtin"
import { lookupProduct } from "@/lib/capture/product-resolver"
import { createClient } from "@/lib/supabase/client"
import { otherCategory, type HouseholdCategory } from "@/lib/categories/types"
import { mapInventoryItem, type InventoryItem } from "@/lib/inventory/item"

export type CaptureFiles = {
  product: File | null
  expiry: File | null
}

export type PreparedCaptureItem = {
  id: string
  position: number
  proposal: CaptureProposal
  productId: string | null
  categoryId: string
  usedFallback: boolean
}

const fallbackProposal: CaptureProposal = {
  displayName: "",
  expiryDate: null,
  storageLocation: "fridge",
  quantity: 1,
  gtin: null,
  expiryType: "unknown",
  categoryKey: null,
  rawProductText: "",
  rawExpiryText: "",
  expiryYearSource: "unknown",
  fieldState: { displayName: "missing", expiryDate: "missing", category: "missing", storageLocation: "check" },
  warnings: ["Couldn’t read the photos"],
  provenance: "manual",
  confidence: { product: 0, expiry: 0 },
  notes: ["Review the photos and enter the details manually."],
}

async function uploadImage(
  path: string,
  file: File,
  kind: "product" | "expiry",
  upsert = false,
) {
  const supabase = createClient()
  const blob = await prepareCaptureImage(file, kind)
  const { error } = await supabase.storage
    .from("capture-images")
    .upload(path, blob, { contentType: blob.type, upsert })
  if (error) throw new Error("A photo could not be uploaded.")
}

async function mapWithConcurrency<T, R>(
  values: T[],
  maximum: number,
  work: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length)
  let cursor = 0
  async function worker() {
    while (cursor < values.length) {
      const index = cursor++
      results[index] = await work(values[index], index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(maximum, values.length) }, worker))
  return results
}

function categoryForKey(categories: HouseholdCategory[], key: CaptureProposal["categoryKey"]) {
  return categories.find((category) => category.systemKey === key)
    ?? otherCategory(categories)
}

export async function prepareCapture(
  householdId: string,
  userId: string,
  mode: CaptureMode,
  rows: CaptureFiles[],
  categories: HouseholdCategory[],
  onProgress?: (completed: number, total: number) => void,
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

  const uploaded = await mapWithConcurrency(usableRows, 2, async (row, position) => {
    const { data: item, error: itemError } = await supabase
      .from("capture_items")
      .insert({ session_id: session.id, position })
      .select("id")
      .single()
    if (itemError || !item) throw new Error("A capture item could not be created.")

    const base = `${userId}/${session.id}/${item.id}`
    const productPath = row.product ? `${base}/product.webp` : null
    const expiryPath = row.expiry ? `${base}/expiry.webp` : null
    await Promise.all([
      row.product && productPath ? uploadImage(productPath, row.product, "product") : Promise.resolve(),
      row.expiry && expiryPath ? uploadImage(expiryPath, row.expiry, "expiry") : Promise.resolve(),
    ])

    const { error: pathError } = await supabase
      .from("capture_items")
      .update({ product_image_path: productPath, expiry_image_path: expiryPath })
      .eq("id", item.id)
    if (pathError) throw new Error("The uploaded photos could not be attached.")

    return { id: item.id, position }
  })

  let completed = 0
  const prepared = await mapWithConcurrency(uploaded, 2, async (item) => {
    const { data, error } = await supabase.functions.invoke("analyze-capture", {
      body: { captureItemId: item.id },
    })
    const parsed = !error && data?.status === "review"
      ? captureProposalSchema.safeParse(data.proposal)
      : null
    const proposal = parsed?.success ? parsed.data : fallbackProposal
    const normalizedGtin = proposal.gtin ? normalizeGtin(proposal.gtin) : null
    const lookup = normalizedGtin?.success
      ? await lookupProduct(normalizedGtin.gtin, householdId)
      : null
    const resolvedProduct = lookup?.status === "found" ? lookup.product : null
    const remembered = lookup?.status === "found" ? lookup.preference : null
    const suggestedCategory = remembered
      ? categories.find((category) => category.id === remembered.categoryId)
      : categoryForKey(categories, resolvedProduct?.categoryKey ?? proposal.categoryKey)
    completed += 1
    onProgress?.(completed, uploaded.length)
    return {
      id: item.id,
      position: item.position,
      proposal: {
        ...proposal,
        displayName: resolvedProduct?.displayName ?? proposal.displayName,
        storageLocation: remembered?.storageLocation ?? proposal.storageLocation,
        provenance: resolvedProduct ? "saved_product" : proposal.provenance,
        gtin: normalizedGtin?.success ? normalizedGtin.gtin : null,
      },
      productId: resolvedProduct?.id ?? null,
      categoryId: suggestedCategory?.id ?? "",
      usedFallback: !parsed?.success,
    }
  })

  return { sessionId: session.id, items: prepared }
}

export async function loadPendingCapture(
  householdId: string,
  mode: CaptureMode,
  categories: HouseholdCategory[],
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
        categoryId: categoryForKey(categories, parsed.success ? parsed.data.categoryKey : null)?.id ?? "",
        usedFallback: !parsed.success,
      }
    })

  return { sessionId: data.id, items }
}

export async function replaceAndReanalyzeCaptureImage({
  householdId,
  sessionId,
  captureItemId,
  userId,
  kind,
  file,
  categories,
}: {
  householdId: string
  sessionId: string
  captureItemId: string
  userId: string
  kind: "product" | "expiry"
  file: File
  categories: HouseholdCategory[]
}): Promise<PreparedCaptureItem> {
  const supabase = createClient()
  const path = `${userId}/${sessionId}/${captureItemId}/${kind}.webp`
  await uploadImage(path, file, kind, true)
  const pathUpdate = kind === "product"
    ? { product_image_path: path }
    : { expiry_image_path: path }
  const { error: pathError } = await supabase
    .from("capture_items")
    .update(pathUpdate)
    .eq("id", captureItemId)
  if (pathError) throw new Error("The replacement photo could not be attached.")

  const { data, error } = await supabase.functions.invoke("analyze-capture", {
    body: { captureItemId },
  })
  const parsed = !error && data?.status === "review"
    ? captureProposalSchema.safeParse(data.proposal)
    : null
  const proposal = parsed?.success ? parsed.data : fallbackProposal
  const normalizedGtin = proposal.gtin ? normalizeGtin(proposal.gtin) : null
  const lookup = normalizedGtin?.success
    ? await lookupProduct(normalizedGtin.gtin, householdId)
    : null
  const product = lookup?.status === "found" ? lookup.product : null
  const preference = lookup?.status === "found" ? lookup.preference : null
  const category = preference
    ? categories.find((entry) => entry.id === preference.categoryId)
    : categoryForKey(categories, product?.categoryKey ?? proposal.categoryKey)

  return {
    id: captureItemId,
    position: 0,
    proposal: {
      ...proposal,
      displayName: product?.displayName ?? proposal.displayName,
      storageLocation: preference?.storageLocation ?? proposal.storageLocation,
      provenance: product ? "saved_product" : proposal.provenance,
      gtin: normalizedGtin?.success ? normalizedGtin.gtin : null,
    },
    productId: product?.id ?? null,
    categoryId: category?.id ?? "",
    usedFallback: !parsed?.success,
  }
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
): Promise<InventoryItem[]> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("commit_capture_session_v2", {
    p_session_id: sessionId,
    p_confirmed_items: items,
  })
  if (error) throw new Error("The capture could not be saved. Check every item and try again.")
  return (data ?? []).map((row) => mapInventoryItem({
    id: row.id,
    display_name: row.display_name,
    quantity: row.quantity,
    expiry_date: row.expiry_date,
    expiry_type: row.expiry_type,
    storage_location: row.storage_location,
    product_id: row.product_id,
    category_id: row.category_id,
    household_categories: { name: row.category_name, icon_key: row.category_icon_key },
    added_by: row.added_by,
    profiles: { display_name: row.added_by_name },
  }))
}

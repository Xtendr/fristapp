"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { CalendarDaysIcon, CameraIcon, PlusIcon, Trash2Icon } from "lucide-react"

import { ExpiryDateField } from "@/components/expiry-date-field"
import { CategoryPicker } from "@/components/category-picker"
import { QuantityStepper } from "@/components/quantity-stepper"
import { StorageLocationPicker } from "@/components/storage-location-picker"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { commitCapture, discardCapture, loadPendingCapture, prepareCapture, replaceAndReanalyzeCaptureImage, type CaptureFiles, type PreparedCaptureItem } from "@/lib/capture/client"
import { confirmedCaptureItemsSchema, type CaptureMode } from "@/lib/capture/schema"
import { confirmProduct } from "@/lib/capture/product-resolver"
import { useAppSession } from "@/lib/app-session"
import type { ExpiryType, StorageLocation } from "@/lib/supabase/database.types"
import type { CaptureProposal } from "@/lib/capture/schema"

type ReviewItem = {
  id: string
  displayName: string
  expiryDate: string
  expiryType: ExpiryType
  storageLocation: StorageLocation
  quantity: number
  categoryId: string
  productId: string | null
  gtin: string | null
  usedFallback: boolean
  fieldState: CaptureProposal["fieldState"]
  warnings: string[]
  provenance: CaptureProposal["provenance"]
}

const emptyFiles = (): CaptureFiles => ({ product: null, expiry: null })

function CaptureFileButton({
  label,
  file,
  onChange,
}: {
  label: string
  file: File | null
  onChange: (file: File | null) => void
}) {
  const preview = useMemo(
    () => (file ? URL.createObjectURL(file) : null),
    [file]
  )

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  return (
    <label className="relative flex min-h-28 cursor-pointer touch-manipulation flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border bg-background px-3 text-center transition-colors hover:bg-muted">
      {preview ? (
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${preview})` }}
        />
      ) : (
        <CameraIcon className="size-5 text-muted-foreground" />
      )}
      <span className={preview ? "relative rounded-md bg-background/90 px-2 py-1 text-xs font-medium backdrop-blur-sm" : "text-xs font-medium"}>
        {preview ? `Replace ${label.toLowerCase()}` : label}
      </span>
      <input
        className="sr-only"
        type="file"
        accept="image/jpeg,image/webp,image/*"
        capture="environment"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
      />
    </label>
  )
}

function toReview(item: PreparedCaptureItem): ReviewItem {
  return {
    id: item.id,
    displayName: item.proposal.displayName,
    expiryDate: item.proposal.expiryDate ?? "",
    expiryType: item.proposal.expiryType,
    storageLocation: item.proposal.storageLocation,
    quantity: item.proposal.quantity,
    categoryId: item.categoryId,
    productId: item.productId,
    gtin: item.proposal.gtin,
    usedFallback: item.usedFallback,
    fieldState: item.proposal.fieldState,
    warnings: item.proposal.warnings,
    provenance: item.proposal.provenance,
  }
}

export function PhotoCapture({ mode }: { mode: CaptureMode }) {
  const session = useAppSession()
  const [rows, setRows] = useState<CaptureFiles[]>([emptyFiles()])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [review, setReview] = useState<ReviewItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [progress, setProgress] = useState<{ completed: number; total: number } | null>(null)
  const categories = useMemo(() => session.categories ?? [], [session.categories])

  useEffect(() => {
    let active = true
    if (categories.length === 0) return
    void loadPendingCapture(session.householdId, mode, categories).then((capture) => {
      if (!active || !capture) return
      setSessionId(capture.sessionId)
      setReview(capture.items.map(toReview))
    })
    return () => {
      active = false
    }
  }, [categories, mode, session.householdId])

  function updateFiles(index: number, key: keyof CaptureFiles, file: File | null) {
    setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: file } : row))
  }

  function analyze() {
    setError(null)
    setNotice(null)
    startTransition(async () => {
      try {
        setProgress({ completed: 0, total: rows.filter((row) => row.product || row.expiry).length })
        const result = await prepareCapture(
          session.householdId,
          session.userId,
          mode,
          rows,
          categories,
          (completed, total) => setProgress({ completed, total }),
        )
        setSessionId(result.sessionId)
        setReview(result.items.map(toReview))
      } catch (captureError) {
        setError(captureError instanceof Error ? captureError.message : "Capture failed.")
      }
      setProgress(null)
    })
  }

  function save() {
    if (!sessionId) return
    setError(null)
    const parsed = confirmedCaptureItemsSchema.safeParse(
      review.map((item) => ({
        captureItemId: item.id,
        displayName: item.displayName,
        expiryDate: item.expiryDate,
        storageLocation: item.storageLocation,
        quantity: item.quantity,
        expiryType: item.expiryType,
        categoryId: item.categoryId,
        productId: item.productId,
      }))
    )
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check every item.")
      return
    }

    startTransition(async () => {
      try {
        const confirmed = await Promise.all(parsed.data.map(async (item, index) => {
          const reviewItem = review[index]
          if (item.productId || !reviewItem?.gtin) return item
          const product = await confirmProduct(reviewItem.gtin, item.displayName)
          return { ...item, productId: product?.id ?? null }
        }))
        const inserted = await commitCapture(sessionId, confirmed)
        inserted.forEach(session.addInventoryItem)
        setReview([])
        setSessionId(null)
        setRows([emptyFiles()])
        setNotice(`${inserted.length} ${inserted.length === 1 ? "item" : "items"} added to inventory.`)
      } catch (commitError) {
        setError(commitError instanceof Error ? commitError.message : "Capture could not be saved.")
      }
    })
  }

  function replacePhoto(itemId: string, kind: "product" | "expiry", file: File | null) {
    if (!file || !sessionId) return
    setError(null)
    startTransition(async () => {
      try {
        const prepared = await replaceAndReanalyzeCaptureImage({
          householdId: session.householdId,
          sessionId,
          captureItemId: itemId,
          userId: session.userId,
          kind,
          file,
          categories,
        })
        setReview((current) => current.map((item) => item.id === itemId ? toReview(prepared) : item))
      } catch (replacementError) {
        setError(replacementError instanceof Error ? replacementError.message : "The photo could not be replaced.")
      }
    })
  }

  function provenanceLabel(item: ReviewItem) {
    if (item.usedFallback) return "Enter what you can read"
    if (item.provenance === "saved_product") return "Matched a saved product"
    return "Filled from your photos"
  }

  function discard() {
    if (!sessionId) return
    setError(null)
    startTransition(async () => {
      try {
        await discardCapture(sessionId)
        setReview([])
        setSessionId(null)
        setRows([emptyFiles()])
      } catch (discardError) {
        setError(discardError instanceof Error ? discardError.message : "Capture could not be discarded.")
      }
    })
  }

  if (review.length) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="type-title">Review before saving</h2>
          <p className="mt-1 type-body-secondary">Frist filled what it could. Check the highlighted details.</p>
        </div>
        {review.map((item, index) => (
          <div key={item.id} className="rounded-xl border bg-card p-4">
            <div className="mb-4 flex items-center justify-between">
              <p className="type-section">{mode === "batch" ? `Item ${index + 1}` : "Captured item"}</p>
              <span className="rounded-full bg-muted px-2 py-1 type-meta">{provenanceLabel(item)}</span>
            </div>
            <div className="mb-4 grid grid-cols-2 gap-2">
              {(["product", "expiry"] as const).map((kind) => (
                <label key={kind} className="flex min-h-10 cursor-pointer items-center justify-center rounded-lg border bg-background px-3 text-xs font-medium hover:bg-muted">
                  <CameraIcon className="mr-2 size-4" />Replace {kind} photo
                  <input className="sr-only" type="file" accept="image/*" capture="environment" disabled={pending} onChange={(event) => replacePhoto(item.id, kind, event.target.files?.[0] ?? null)} />
                </label>
              ))}
            </div>
            {item.gtin ? <p className="mb-3 type-meta-num">Detected barcode {item.gtin}</p> : null}
            <FieldGroup>
              <Field className={item.fieldState.displayName !== "confident" ? "rounded-lg border border-ring/40 bg-muted/30 p-3" : undefined}>
                <FieldLabel htmlFor={`capture-name-${item.id}`}>Name</FieldLabel>
                <Input id={`capture-name-${item.id}`} value={item.displayName} maxLength={80} onChange={(event) => setReview((current) => current.map((entry) => entry.id === item.id ? { ...entry, displayName: event.target.value } : entry))} />
              </Field>
              <Field className={item.fieldState.expiryDate !== "confident" ? "rounded-lg border border-ring/40 bg-muted/30 p-3" : undefined}>
                <FieldLabel htmlFor={`capture-expiry-${item.id}`}>Expiry</FieldLabel>
                <ExpiryDateField id={`capture-expiry-${item.id}`} name={`capture-expiry-${item.id}`} value={item.expiryDate} onChange={(expiryDate) => setReview((current) => current.map((entry) => entry.id === item.id ? { ...entry, expiryDate } : entry))} />
              </Field>
              <Field>
                <FieldLabel>Date label</FieldLabel>
                <div className="grid grid-cols-3 gap-2">
                  {([["best_before", "Best before"], ["use_by", "Use by"], ["unknown", "Not sure"]] as const).map(([value, label]) => (
                    <button key={value} type="button" aria-pressed={item.expiryType === value} onClick={() => setReview((current) => current.map((entry) => entry.id === item.id ? { ...entry, expiryType: value } : entry))} className={`min-h-10 rounded-lg border px-2 text-xs font-medium ${item.expiryType === value ? "border-primary bg-primary text-primary-foreground" : "border-input text-muted-foreground"}`}>{label}</button>
                  ))}
                </div>
              </Field>
              <Field>
                <FieldLabel>Storage</FieldLabel>
                <StorageLocationPicker name={`capture-storage-${item.id}`} value={item.storageLocation} onChange={(storageLocation) => setReview((current) => current.map((entry) => entry.id === item.id ? { ...entry, storageLocation } : entry))} />
              </Field>
              <Field className={item.fieldState.category !== "confident" ? "rounded-lg border border-ring/40 bg-muted/30 p-3" : undefined}>
                <FieldLabel htmlFor={`capture-category-${item.id}`}>Category</FieldLabel>
                <CategoryPicker id={`capture-category-${item.id}`} name={`capture-category-${item.id}`} categories={categories} value={item.categoryId} onChange={(categoryId) => setReview((current) => current.map((entry) => entry.id === item.id ? { ...entry, categoryId } : entry))} />
              </Field>
              <Field>
                <FieldLabel htmlFor={`capture-quantity-${item.id}`}>Quantity</FieldLabel>
                <QuantityStepper id={`capture-quantity-${item.id}`} name={`capture-quantity-${item.id}`} value={item.quantity} onChange={(quantity) => setReview((current) => current.map((entry) => entry.id === item.id ? { ...entry, quantity } : entry))} />
              </Field>
            </FieldGroup>
            {item.fieldState.expiryDate === "check" ? <p className="mt-3 text-xs font-medium text-status-today">Check this date</p> : null}
            {item.fieldState.expiryDate === "missing" ? <p className="mt-3 text-xs font-medium text-muted-foreground">Couldn’t read the date</p> : null}
            {item.warnings.length ? <ul className="mt-2 space-y-1 text-xs text-muted-foreground">{item.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : null}
          </div>
        ))}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="button" size="lg" disabled={pending} onClick={save}>
          {pending ? <Spinner data-icon="inline-start" /> : null}
          {pending ? "Saving…" : `Save ${review.length === 1 ? "item" : `${review.length} items`}`}
        </Button>
        <Button type="button" variant="ghost" disabled={pending} onClick={discard}>Discard capture</Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="type-title">{mode === "photo" ? "Capture one item" : "Capture a batch"}</h2>
        <p className="mt-1 type-body-secondary">{mode === "photo" ? "Add a product photo, an expiry photo, or both." : "Keep every product paired with its own expiry photo."}</p>
      </div>

      {rows.map((row, index) => (
        <div key={index} className="rounded-xl border bg-card p-3">
          <div className="mb-3 flex items-center justify-between">
            <p className="type-section">{mode === "batch" ? `Item ${index + 1}` : "Photos"}</p>
            {mode === "batch" && rows.length > 1 ? (
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove item ${index + 1}`} onClick={() => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}><Trash2Icon /></Button>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <CaptureFileButton label="Product photo" file={row.product} onChange={(file) => updateFiles(index, "product", file)} />
            <CaptureFileButton label="Expiry photo" file={row.expiry} onChange={(file) => updateFiles(index, "expiry", file)} />
          </div>
        </div>
      ))}

      {mode === "batch" && rows.length < 12 ? (
        <Button type="button" variant="outline" onClick={() => setRows((current) => [...current, emptyFiles()])}><PlusIcon />Add another item</Button>
      ) : null}
      {notice ? <p className="rounded-lg border bg-card p-3 type-body">{notice}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="button" size="lg" disabled={pending || !rows.some((row) => row.product || row.expiry)} onClick={analyze}>
        {pending ? <Spinner data-icon="inline-start" /> : <CalendarDaysIcon data-icon="inline-start" />}
        {pending ? (progress ? `Reading ${progress.completed} of ${progress.total}…` : "Preparing photos…") : mode === "photo" ? "Review item" : "Review batch"}
      </Button>
      <p className="type-meta">For the expiry photo, move close enough that the printed date fills most of the frame. Photos are deleted after the short review window.</p>
    </div>
  )
}

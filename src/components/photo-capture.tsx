"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { CalendarDaysIcon, CameraIcon, PlusIcon, Trash2Icon } from "lucide-react"

import { ExpiryDateField } from "@/components/expiry-date-field"
import { QuantityStepper } from "@/components/quantity-stepper"
import { StorageLocationPicker } from "@/components/storage-location-picker"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { commitCapture, discardCapture, loadPendingCapture, prepareCapture, type CaptureFiles, type PreparedCaptureItem } from "@/lib/capture/client"
import { confirmedCaptureItemsSchema, type CaptureMode } from "@/lib/capture/schema"
import { confirmProduct } from "@/lib/capture/product-resolver"
import { useAppSession } from "@/lib/app-session"
import type { StorageLocation } from "@/lib/supabase/database.types"

type ReviewItem = {
  id: string
  displayName: string
  expiryDate: string
  storageLocation: StorageLocation
  quantity: number
  productId: string | null
  gtin: string | null
  usedFallback: boolean
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
    storageLocation: item.proposal.storageLocation,
    quantity: item.proposal.quantity,
    productId: item.productId,
    gtin: item.proposal.gtin,
    usedFallback: item.usedFallback,
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

  useEffect(() => {
    let active = true
    void loadPendingCapture(session.householdId, mode).then((capture) => {
      if (!active || !capture) return
      setSessionId(capture.sessionId)
      setReview(capture.items.map(toReview))
    })
    return () => {
      active = false
    }
  }, [mode, session.householdId])

  function updateFiles(index: number, key: keyof CaptureFiles, file: File | null) {
    setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: file } : row))
  }

  function analyze() {
    setError(null)
    setNotice(null)
    startTransition(async () => {
      try {
        const result = await prepareCapture(session.householdId, session.userId, mode, rows)
        setSessionId(result.sessionId)
        setReview(result.items.map(toReview))
      } catch (captureError) {
        setError(captureError instanceof Error ? captureError.message : "Capture failed.")
      }
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
        const count = await commitCapture(sessionId, confirmed)
        await session.refreshInventory()
        setReview([])
        setSessionId(null)
        setRows([emptyFiles()])
        setNotice(`${count} ${count === 1 ? "item" : "items"} added to inventory.`)
      } catch (commitError) {
        setError(commitError instanceof Error ? commitError.message : "Capture could not be saved.")
      }
    })
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
          <p className="mt-1 type-body-secondary">AI suggestions are never added without your confirmation.</p>
        </div>
        {review.map((item, index) => (
          <div key={item.id} className="rounded-xl border bg-card p-4">
            <div className="mb-4 flex items-center justify-between">
              <p className="type-section">{mode === "batch" ? `Item ${index + 1}` : "Captured item"}</p>
              {item.usedFallback ? <span className="rounded-full bg-muted px-2 py-1 type-meta">Manual review</span> : null}
            </div>
            {item.gtin ? <p className="mb-3 type-meta-num">Detected barcode {item.gtin}</p> : null}
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={`capture-name-${item.id}`}>Name</FieldLabel>
                <Input id={`capture-name-${item.id}`} value={item.displayName} maxLength={80} onChange={(event) => setReview((current) => current.map((entry) => entry.id === item.id ? { ...entry, displayName: event.target.value } : entry))} />
              </Field>
              <Field>
                <FieldLabel htmlFor={`capture-expiry-${item.id}`}>Expiry</FieldLabel>
                <ExpiryDateField id={`capture-expiry-${item.id}`} name={`capture-expiry-${item.id}`} value={item.expiryDate} onChange={(expiryDate) => setReview((current) => current.map((entry) => entry.id === item.id ? { ...entry, expiryDate } : entry))} />
              </Field>
              <Field>
                <FieldLabel>Storage</FieldLabel>
                <StorageLocationPicker name={`capture-storage-${item.id}`} value={item.storageLocation} onChange={(storageLocation) => setReview((current) => current.map((entry) => entry.id === item.id ? { ...entry, storageLocation } : entry))} />
              </Field>
              <Field>
                <FieldLabel htmlFor={`capture-quantity-${item.id}`}>Quantity</FieldLabel>
                <QuantityStepper id={`capture-quantity-${item.id}`} name={`capture-quantity-${item.id}`} value={item.quantity} onChange={(quantity) => setReview((current) => current.map((entry) => entry.id === item.id ? { ...entry, quantity } : entry))} />
              </Field>
            </FieldGroup>
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
        {pending ? "Uploading and analyzing…" : mode === "photo" ? "Review item" : "Review batch"}
      </Button>
      <p className="type-meta">Photos stay private to your household. Frist fills what it can; you review every item before anything is saved.</p>
    </div>
  )
}

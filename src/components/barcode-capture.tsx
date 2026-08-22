"use client"

import { useEffect, useRef, useState } from "react"
import { CameraIcon, ImageIcon, RotateCcwIcon, ScanLineIcon } from "lucide-react"

import { InventoryItemForm } from "@/components/inventory-item-form"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { normalizeGtin, type BarcodeKind } from "@/lib/capture/gtin"
import { lookupProduct, type ResolvedProduct } from "@/lib/capture/product-resolver"
import { cn } from "@/lib/utils"
import { useAppSession } from "@/lib/app-session"
import { otherCategory } from "@/lib/categories/types"
import type { ProductPreference } from "@/lib/capture/product-resolver"

type ScanState =
  | { status: "idle" }
  | { status: "scanning" }
  | { status: "looking_up"; gtin: string }
  | { status: "ready"; gtin: string; product: ResolvedProduct | null; preference: ProductPreference | null; lookupUnavailable: boolean }
  | { status: "error"; message: string }

function barcodeKind(value: string): BarcodeKind {
  if (["EAN_8", "EAN_13", "UPC_A", "UPC_E"].includes(value)) return value as BarcodeKind
  return "UNKNOWN"
}

export function BarcodeCapture() {
  const { householdId, categories } = useAppSession()
  const [state, setState] = useState<ScanState>({ status: "idle" })
  const [typedCode, setTypedCode] = useState("")
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<{ stop: () => void } | null>(null)
  const handlingRef = useRef(false)

  function stopScanner() {
    controlsRef.current?.stop()
    controlsRef.current = null
  }

  useEffect(() => stopScanner, [])

  async function resolve(raw: string, kind: BarcodeKind = "UNKNOWN") {
    if (handlingRef.current) return
    const normalized = normalizeGtin(raw, kind)
    if (!normalized.success) {
      setState({ status: "error", message: normalized.error })
      return
    }

    handlingRef.current = true
    stopScanner()
    setState({ status: "looking_up", gtin: normalized.gtin })
    const result = await lookupProduct(normalized.gtin, householdId)
    setState({
      status: "ready",
      gtin: normalized.gtin,
      product: result.status === "found" ? result.product : null,
      preference: result.status === "found" ? result.preference : null,
      lookupUnavailable: result.status === "unavailable",
    })
    handlingRef.current = false
  }

  async function startScanner() {
    stopScanner()
    handlingRef.current = false
    setState({ status: "scanning" })
    try {
      const { BarcodeFormat, BrowserMultiFormatReader } = await import("@zxing/browser")
      const reader = new BrowserMultiFormatReader()
      reader.possibleFormats = [
        BarcodeFormat.EAN_8,
        BarcodeFormat.EAN_13,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
      ]
      if (!videoRef.current) throw new Error("Camera preview is unavailable.")
      controlsRef.current = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" } }, audio: false },
        videoRef.current,
        (result) => {
          if (!result) return
          const format = BarcodeFormat[result.getBarcodeFormat()]
          void resolve(result.getText(), barcodeKind(format))
        }
      )
    } catch {
      stopScanner()
      setState({ status: "error", message: "Camera access failed. Use a barcode photo or enter the number." })
    }
  }

  async function scanImage(file: File | null) {
    if (!file) return
    handlingRef.current = false
    setState({ status: "looking_up", gtin: "" })
    try {
      const { BarcodeFormat, BrowserMultiFormatReader } = await import("@zxing/browser")
      const objectUrl = URL.createObjectURL(file)
      const image = new Image()
      image.src = objectUrl
      await image.decode()
      const result = await new BrowserMultiFormatReader().decodeFromImageElement(image)
      URL.revokeObjectURL(objectUrl)
      await resolve(result.getText(), barcodeKind(BarcodeFormat[result.getBarcodeFormat()]))
    } catch {
      setState({ status: "error", message: "No supported barcode was found in that image." })
    }
  }

  function reset() {
    stopScanner()
    handlingRef.current = false
    setTypedCode("")
    setState({ status: "idle" })
  }

  function stopAndReset() {
    stopScanner()
    handlingRef.current = false
    setState({ status: "idle" })
  }

  const ready = state.status === "ready" ? state : null
  const suggestedCategoryId = ready?.preference?.categoryId
    ?? categories?.find((category) => category.systemKey === ready?.product?.categoryKey)?.id
    ?? otherCategory(categories ?? [])?.id
    ?? ""
  return (
    <div className="flex flex-col gap-4">
      {!ready ? <div className="overflow-hidden rounded-xl border bg-card">
        {state.status === "scanning" ? (
          <div className="relative aspect-[4/3] bg-black">
            <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
            <div className="pointer-events-none absolute inset-[18%] rounded-lg border border-white/80" />
            <p className="absolute inset-x-0 bottom-4 text-center text-xs font-medium text-white">Align the barcode inside the frame</p>
          </div>
        ) : (
          <div className="flex min-h-36 flex-col items-center justify-center gap-3 px-6 py-7 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-muted"><ScanLineIcon className="size-5" /></span>
            <div>
              <p className="type-body">Scan a packaged product</p>
              <p className="mt-1 type-meta">Frist checks its product cache, then Open Food Facts.</p>
            </div>
          </div>
        )}
      </div> : null}

      {ready ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2.5">
          <div className="min-w-0">
            <p className="type-meta-num">{ready.gtin}</p>
            <p className="truncate type-body">{ready.product?.displayName ?? "New product"}</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={reset}>
            <RotateCcwIcon data-icon="inline-start" />Scan again
          </Button>
        </div>
      ) : null}

      {state.status === "idle" || state.status === "scanning" || state.status === "error" ? (
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant={state.status === "scanning" ? "default" : "outline"} onClick={state.status === "scanning" ? stopAndReset : startScanner}>
            <CameraIcon data-icon="inline-start" />{state.status === "scanning" ? "Stop" : "Use camera"}
          </Button>
          <label className={cn(buttonVariants({ variant: "outline" }), "cursor-pointer")}>
            <ImageIcon data-icon="inline-start" />Barcode photo<input className="sr-only" type="file" accept="image/*" onChange={(event) => void scanImage(event.target.files?.[0] ?? null)} />
          </label>
        </div>
      ) : null}

      {state.status === "idle" || state.status === "error" ? (
        <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void resolve(typedCode) }}>
          <Input inputMode="numeric" autoComplete="off" value={typedCode} onChange={(event) => setTypedCode(event.target.value)} placeholder="Enter barcode number" aria-label="Barcode number" />
          <Button type="submit" variant="outline">Check</Button>
        </form>
      ) : null}

      {state.status === "looking_up" ? <p className="flex items-center gap-2 type-body-secondary"><Spinner />Checking product…</p> : null}
      {state.status === "error" ? <p className="text-sm text-destructive">{state.message}</p> : null}
      {ready?.lookupUnavailable ? <p className="type-meta">Online lookup is unavailable. You can still name and save this product.</p> : null}

      {ready ? (
        <div className="rounded-xl border bg-card p-4">
          <InventoryItemForm
            key={`${ready.gtin}-${ready.product?.id ?? "new"}`}
            mode="create"
            initialValues={{ displayName: ready.product?.displayName ?? "", expiryDate: "", expiryType: "unknown", storageLocation: ready.preference?.storageLocation ?? "fridge", quantity: 1, categoryId: suggestedCategoryId }}
            captureContext={{ source: "barcode", productId: ready.product?.id, gtin: ready.gtin }}
            submitLabel="Add to inventory"
            onSaved={reset}
          />
        </div>
      ) : null}
    </div>
  )
}

"use client"

import { useState, useTransition } from "react"
import { Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import { ExpiryDateField } from "@/components/expiry-date-field"
import { QuantityStepper } from "@/components/quantity-stepper"
import { StorageLocationPicker } from "@/components/storage-location-picker"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import {
  createInventoryItem,
  deleteInventoryItem,
  updateInventoryItem,
} from "@/lib/inventory/actions"
import { useOptionalAppSession } from "@/lib/app-session"
import { confirmProduct } from "@/lib/capture/product-resolver"
import type { StorageLocation } from "@/lib/supabase/database.types"

export type InventoryFormValues = {
  displayName: string
  expiryDate: string
  storageLocation: StorageLocation
  quantity: number
}

const emptyCreateValues: InventoryFormValues = {
  displayName: "",
  expiryDate: "",
  storageLocation: "fridge",
  quantity: 1,
}

export function InventoryItemForm({
  mode,
  itemId,
  initialValues,
  captureContext,
  submitLabel,
  autoFocus = true,
  onSaved,
}: {
  mode: "create" | "edit"
  itemId?: string
  initialValues?: InventoryFormValues
  captureContext?: {
    source: "barcode"
    productId?: string | null
    gtin?: string | null
  }
  submitLabel?: string
  autoFocus?: boolean
  onSaved?: (name: string) => void
}) {
  const [values, setValues] = useState<InventoryFormValues>(
    initialValues ?? emptyCreateValues
  )
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const session = useOptionalAppSession()

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!values.expiryDate) {
      setError("Choose an expiry date.")
      return
    }

    const formData = new FormData(event.currentTarget)

    startTransition(async () => {
      if (mode === "create") {
        formData.set("source", captureContext?.source ?? "manual")
        let productId = captureContext?.productId ?? null
        if (!productId && captureContext?.gtin && values.displayName.trim()) {
          const confirmed = await confirmProduct(
            captureContext.gtin,
            values.displayName
          )
          productId = confirmed?.id ?? null
        }
        if (productId) formData.set("productId", productId)
        const result = await createInventoryItem(formData)
        if ("error" in result) {
          setError(result.error)
          return
        }
        session?.addInventoryItem(result.item)
        toast.success(`${result.item.displayName} added to inventory.`)
        onSaved?.(result.item.displayName)
        setValues((current) => ({
          displayName: "",
          expiryDate: "",
          storageLocation: current.storageLocation,
          quantity: 1,
        }))
        return
      }

      if (!itemId) {
        setError("Item is missing.")
        return
      }
      const result = await updateInventoryItem(itemId, formData)
      if ("error" in result) {
        setError(result.error)
        return
      }

      session?.updateInventoryItem(result.item)
      toast.success(`${result.item.displayName} updated.`)
      session?.closeInventoryItem()
    })
  }

  function onDelete() {
    if (!itemId) {
      return
    }
    setError(null)

    const removedItem = {
      id: itemId,
      displayName: initialValues?.displayName ?? values.displayName,
      expiryDate: initialValues?.expiryDate ?? values.expiryDate,
      storageLocation:
        initialValues?.storageLocation ?? values.storageLocation,
      quantity: initialValues?.quantity ?? values.quantity,
    }

    session?.removeInventoryItem(itemId)
    session?.closeInventoryItem()

    startTransition(async () => {
      const result = await deleteInventoryItem(itemId)
      if ("error" in result) {
        session?.addInventoryItem(removedItem)
        if (session) {
          toast.error("The item could not be removed. It has been restored.")
        } else {
          setError(result.error)
        }
        return
      }

      toast.success(`${removedItem.displayName} removed.`)
    })
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="displayName">Name</FieldLabel>
          <Input
            id="displayName"
            name="displayName"
            value={values.displayName}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                displayName: event.target.value,
              }))
            }
            autoComplete="off"
            autoFocus={mode === "create" && autoFocus}
            maxLength={80}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="expiryDate">Expiry</FieldLabel>
          <ExpiryDateField
            id="expiryDate"
            name="expiryDate"
            value={values.expiryDate}
            onChange={(expiryDate) =>
              setValues((current) => ({
                ...current,
                expiryDate,
              }))
            }
            required
          />
        </Field>
        <Field>
          <FieldLabel>Storage</FieldLabel>
          <StorageLocationPicker
            name="storageLocation"
            value={values.storageLocation}
            onChange={(storageLocation) =>
              setValues((current) => ({ ...current, storageLocation }))
            }
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="quantity">Quantity</FieldLabel>
          <QuantityStepper
            id="quantity"
            name="quantity"
            value={values.quantity}
            onChange={(quantity) =>
              setValues((current) => ({
                ...current,
                quantity,
              }))
            }
          />
        </Field>
      </FieldGroup>
      {error ? <FieldError>{error}</FieldError> : null}
      <div className="flex flex-col gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? <Spinner data-icon="inline-start" /> : null}
          {pending ? "Saving…" : mode === "create" ? submitLabel ?? "Save" : "Save changes"}
        </Button>
        {mode === "edit" ? (
          <AlertDialog>
            <AlertDialogTrigger
              render={<Button type="button" variant="destructive" disabled={pending} />}
            >
              Remove
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogMedia><Trash2Icon /></AlertDialogMedia>
                <AlertDialogTitle>Remove this item?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes it from the household inventory. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={onDelete}>
                  Remove item
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </div>
    </form>
  )
}

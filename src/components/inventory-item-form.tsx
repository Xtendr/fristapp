"use client"

import { useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  createInventoryItem,
  deleteInventoryItem,
  updateInventoryItem,
} from "@/lib/inventory/actions"
import { useOptionalAppSession } from "@/lib/app-session"
import { storageLabel } from "@/lib/inventory/expiry"
import { storageLocations } from "@/lib/inventory/schema"
import type { StorageLocation } from "@/lib/supabase/database.types"
import { cn } from "@/lib/utils"

type FormValues = {
  displayName: string
  expiryDate: string
  storageLocation: StorageLocation
  quantity: number
}

const emptyCreateValues: FormValues = {
  displayName: "",
  expiryDate: "",
  storageLocation: "fridge",
  quantity: 1,
}

export function InventoryItemForm({
  mode,
  itemId,
  initialValues,
}: {
  mode: "create" | "edit"
  itemId?: string
  initialValues?: FormValues
}) {
  const [values, setValues] = useState<FormValues>(
    initialValues ?? emptyCreateValues
  )
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [pending, startTransition] = useTransition()
  const session = useOptionalAppSession()

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    setError(null)
    setNotice(null)
    setConfirmingDelete(false)

    startTransition(async () => {
      if (mode === "create") {
        const result = await createInventoryItem(formData)
        if ("error" in result) {
          setError(result.error)
          return
        }
        setNotice(`Added ${result.added}`)
        setValues((current) => ({
          displayName: "",
          expiryDate: "",
          storageLocation: current.storageLocation,
          quantity: 1,
        }))
        await session?.refreshInventory()
        return
      }

      if (!itemId) {
        setError("Item is missing.")
        return
      }
      const result = await updateInventoryItem(itemId, formData)
      if (result?.error) {
        setError(result.error)
      }
    })
  }

  function onDelete() {
    if (!itemId) {
      return
    }
    if (!confirmingDelete) {
      setConfirmingDelete(true)
      setError(null)
      return
    }

    startTransition(async () => {
      const result = await deleteInventoryItem(itemId)
      if (result?.error) {
        setError(result.error)
        setConfirmingDelete(false)
      }
    })
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <input
        type="hidden"
        name="storageLocation"
        value={values.storageLocation}
      />
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
            autoFocus={mode === "create"}
            maxLength={80}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="expiryDate">Expiry</FieldLabel>
          <Input
            id="expiryDate"
            name="expiryDate"
            type="date"
            value={values.expiryDate}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                expiryDate: event.target.value,
              }))
            }
            required
          />
        </Field>
        <Field>
          <FieldLabel>Storage</FieldLabel>
          <div className="grid grid-cols-3 gap-2">
            {storageLocations.map((location) => (
              <Button
                key={location}
                type="button"
                size="sm"
                variant={
                  values.storageLocation === location ? "default" : "outline"
                }
                onClick={() =>
                  setValues((current) => ({
                    ...current,
                    storageLocation: location,
                  }))
                }
              >
                {storageLabel(location)}
              </Button>
            ))}
          </div>
        </Field>
        <Field>
          <FieldLabel htmlFor="quantity">Quantity</FieldLabel>
          <Input
            id="quantity"
            name="quantity"
            type="number"
            min={1}
            max={99}
            value={values.quantity}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                quantity: Number(event.target.value),
              }))
            }
            required
          />
        </Field>
      </FieldGroup>
      {notice ? (
        <p className="text-sm text-muted-foreground">{notice}</p>
      ) : null}
      {error ? <FieldError>{error}</FieldError> : null}
      <div className="flex flex-col gap-2">
        <Button type="submit" disabled={pending}>
          {pending
            ? "Saving"
            : mode === "create"
              ? "Save"
              : "Save changes"}
        </Button>
        {mode === "edit" ? (
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            className={cn(confirmingDelete && "ring-1 ring-destructive/40")}
            onClick={onDelete}
          >
            {confirmingDelete ? "Remove this item?" : "Remove"}
          </Button>
        ) : null}
      </div>
    </form>
  )
}

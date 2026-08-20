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
import { renameHousehold } from "@/lib/household/actions"

export function RenameHouseholdForm({
  householdId,
  currentName,
  onRenamed,
}: {
  householdId: string
  currentName: string
  onRenamed?: (name: string) => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    setError(null)
    startTransition(async () => {
      const result = await renameHousehold(formData)
      if (result?.error) {
        setError(result.error)
        return
      }
      const name = String(formData.get("name") ?? "").trim()
      if (name) {
        onRenamed?.(name)
      }
    })
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <input type="hidden" name="householdId" value={householdId} />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="name">Household name</FieldLabel>
          <Input
            id="name"
            name="name"
            defaultValue={currentName}
            required
            maxLength={80}
          />
        </Field>
      </FieldGroup>
      {error ? <FieldError>{error}</FieldError> : null}
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "Saving" : "Save name"}
      </Button>
    </form>
  )
}

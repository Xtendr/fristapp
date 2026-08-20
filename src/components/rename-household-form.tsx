"use client"

import { useRouter } from "next/navigation"
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
}: {
  householdId: string
  currentName: string
}) {
  const router = useRouter()
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
      router.refresh()
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

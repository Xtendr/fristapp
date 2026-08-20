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
import { createHousehold } from "@/lib/household/actions"

export function CreateHouseholdForm() {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    setError(null)
    startTransition(async () => {
      const result = await createHousehold(formData)
      if (result?.error) {
        setError(result.error)
      }
    })
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <FieldGroup>
        <Field data-invalid={error ? true : undefined}>
          <FieldLabel htmlFor="name">Household name</FieldLabel>
          <Input
            id="name"
            name="name"
            required
            maxLength={80}
            aria-invalid={error ? true : undefined}
          />
        </Field>
      </FieldGroup>
      {error ? <FieldError>{error}</FieldError> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Creating" : "Create household"}
      </Button>
    </form>
  )
}

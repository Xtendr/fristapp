"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export function JoinTokenForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = String(new FormData(event.currentTarget).get("token") ?? "").trim()
    if (!value) {
      setError("Paste an invite token or the full invite link.")
      return
    }

    const token = value.includes("/join/")
      ? value.split("/join/").pop()?.split(/[?#]/)[0]
      : value

    if (!token) {
      setError("That invite link is not valid.")
      return
    }

    router.push(`/join/${encodeURIComponent(token)}`)
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <FieldGroup>
        <Field data-invalid={error ? true : undefined}>
          <FieldLabel htmlFor="token">Invite link or token</FieldLabel>
          <Input
            id="token"
            name="token"
            autoComplete="off"
            aria-invalid={error ? true : undefined}
          />
        </Field>
      </FieldGroup>
      {error ? <FieldError>{error}</FieldError> : null}
      <Button type="submit" variant="outline">
        Continue
      </Button>
    </form>
  )
}

"use client"

import { useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import { FieldError } from "@/components/ui/field"
import { acceptInvite } from "@/lib/household/actions"

export function AcceptInviteButton({ token }: { token: string }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null)
          startTransition(async () => {
            const result = await acceptInvite(token)
            if (result?.error) {
              setError(result.error)
            }
          })
        }}
      >
        {pending ? "Joining" : "Join household"}
      </Button>
      {error ? <FieldError>{error}</FieldError> : null}
    </div>
  )
}

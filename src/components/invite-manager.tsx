"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import { FieldError } from "@/components/ui/field"
import { createInvite, revokeInvite } from "@/lib/household/actions"

type Invite = {
  id: string
  expires_at: string
  revoked_at: string | null
}

export function InviteManager({
  householdId,
  invites,
}: {
  householdId: string
  invites: Invite[]
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [freshUrl, setFreshUrl] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const active = invites.filter((invite) => !invite.revoked_at)

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium">Invites</h2>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => {
            setError(null)
            startTransition(async () => {
              const result = await createInvite(householdId)
              if ("error" in result) {
                setError(result.error)
                return
              }
              setFreshUrl(result.url)
              router.refresh()
            })
          }}
        >
          {pending ? "Working" : "New invite"}
        </Button>
      </div>
      <p className="text-sm leading-6 text-muted-foreground">
        The full link is shown once when you create it. Share it in Messages or
        WhatsApp. It stays valid for 7 days unless you revoke it.
      </p>
      {freshUrl ? (
        <p className="break-all rounded-lg border border-border px-3 py-2 text-sm">
          {freshUrl}
        </p>
      ) : null}
      {active.length === 0 ? (
        <p className="text-sm text-muted-foreground">No active invites.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {active.map((invite) => (
            <li
              key={invite.id}
              className="flex items-center justify-between gap-3 border-b border-border py-2 text-sm"
            >
              <span className="text-muted-foreground">
                Expires {new Date(invite.expires_at).toLocaleDateString()}
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  setError(null)
                  startTransition(async () => {
                    const result = await revokeInvite(invite.id)
                    if (result?.error) {
                      setError(result.error)
                      return
                    }
                    router.refresh()
                  })
                }}
              >
                Revoke
              </Button>
            </li>
          ))}
        </ul>
      )}
      {error ? <FieldError>{error}</FieldError> : null}
    </section>
  )
}

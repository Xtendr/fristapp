"use client"

import { useState, useTransition } from "react"
import { CopyIcon, Share2Icon } from "lucide-react"
import { toast } from "sonner"

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
  onChanged,
}: {
  householdId: string
  invites: Invite[]
  onChanged?: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [freshUrl, setFreshUrl] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const active = invites.filter((invite) => !invite.revoked_at)

  async function shareInvite() {
    if (!freshUrl) return
    try {
      if (navigator.share) {
        await navigator.share({ title: "Join my Frist household", url: freshUrl })
        return
      }
      await navigator.clipboard.writeText(freshUrl)
      toast.success("Invite link copied.")
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === "AbortError") {
        return
      }
      toast.error("Could not share the invite link.")
    }
  }

  async function copyInvite() {
    if (!freshUrl) return
    try {
      await navigator.clipboard.writeText(freshUrl)
      toast.success("Invite link copied.")
    } catch {
      toast.error("Could not copy the invite link.")
    }
  }

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
              onChanged?.()
            })
          }}
        >
          {pending ? "Working" : "New invite"}
        </Button>
      </div>
      <p className="text-sm leading-6 text-muted-foreground">
        Invite links work for 7 days and are shown once when created.
      </p>
      {freshUrl ? (
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <p className="break-all text-sm">{freshUrl}</p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void copyInvite()}
            >
              <CopyIcon data-icon="inline-start" />Copy
            </Button>
            <Button type="button" onClick={() => void shareInvite()}>
              <Share2Icon data-icon="inline-start" />Share
            </Button>
          </div>
        </div>
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
                    onChanged?.()
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

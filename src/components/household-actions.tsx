"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import {
  leaveHousehold,
  removeMember,
  selectHousehold,
} from "@/lib/household/actions"
import { signOut } from "@/lib/auth/actions"
import { unsubscribeBrowserPush } from "@/lib/push/browser"

export function SignOutButton() {
  const [pending, startTransition] = useTransition()

  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await unsubscribeBrowserPush()
          await signOut()
        })
      }
    >
      {pending ? "Signing out" : "Sign out"}
    </Button>
  )
}

export function LeaveHouseholdButton({ householdId }: { householdId: string }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="destructive"
        disabled={pending}
        onClick={() => {
          setError(null)
          startTransition(async () => {
            const result = await leaveHousehold(householdId)
            if (result?.error) {
              setError(result.error)
            }
          })
        }}
      >
        {pending ? "Leaving" : "Leave household"}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}

export function RemoveMemberButton({
  householdId,
  userId,
}: {
  householdId: string
  userId: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await removeMember(householdId, userId)
          router.refresh()
        })
      }
    >
      {pending ? "Removing" : "Remove"}
    </Button>
  )
}

export function SelectHouseholdButton({
  householdId,
  name,
}: {
  householdId: string
  name: string
}) {
  const [pending, startTransition] = useTransition()

  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={() => startTransition(() => selectHousehold(householdId))}
    >
      {pending ? "Opening" : name}
    </Button>
  )
}

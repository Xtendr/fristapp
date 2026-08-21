"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { LogOutIcon, UserMinusIcon } from "lucide-react"

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
import { Spinner } from "@/components/ui/spinner"
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
      {pending ? <Spinner data-icon="inline-start" /> : null}
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  )
}

export function LeaveHouseholdButton({ householdId }: { householdId: string }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function leave() {
    setError(null)
    startTransition(async () => {
      const result = await leaveHousehold(householdId)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <AlertDialog>
        <AlertDialogTrigger render={<Button type="button" variant="destructive" disabled={pending} />}>
          {pending ? <Spinner data-icon="inline-start" /> : null}
          {pending ? "Leaving…" : "Leave household"}
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia><LogOutIcon /></AlertDialogMedia>
            <AlertDialogTitle>Leave this household?</AlertDialogTitle>
            <AlertDialogDescription>
              You will lose access to its inventory and reminders until someone invites you again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={leave}>Leave household</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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

  function remove() {
    startTransition(async () => {
      await removeMember(householdId, userId)
      router.refresh()
    })
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button type="button" size="sm" variant="ghost" disabled={pending} />}>
        {pending ? "Removing…" : "Remove"}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia><UserMinusIcon /></AlertDialogMedia>
          <AlertDialogTitle>Remove this member?</AlertDialogTitle>
          <AlertDialogDescription>
            They will immediately lose access to this household and its inventory.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={remove}>Remove member</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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

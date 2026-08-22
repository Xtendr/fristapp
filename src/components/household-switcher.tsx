"use client"

import { useTransition } from "react"
import { ChevronRightIcon } from "lucide-react"

import { Spinner } from "@/components/ui/spinner"
import { useAppSession } from "@/lib/app-session"
import { selectHousehold } from "@/lib/household/actions"

export function HouseholdSwitcher() {
  const { householdId, memberships } = useAppSession()
  const [pending, startTransition] = useTransition()
  if (!memberships || memberships.length < 2) return null

  return (
    <section className="flex flex-col gap-2">
      <h2 className="type-section">Switch household</h2>
      <div className="rounded-xl border bg-card px-3">
        {memberships.map((membership) => (
          <button key={membership.householdId} type="button" disabled={pending || membership.householdId === householdId} onClick={() => startTransition(() => selectHousehold(membership.householdId))} className="flex min-h-12 w-full items-center justify-between gap-3 border-b border-border text-left text-sm last:border-b-0 disabled:opacity-60">
            <span><span className="font-medium">{membership.householdName}</span><span className="ml-2 text-xs capitalize text-muted-foreground">{membership.role}</span></span>
            {pending ? <Spinner /> : membership.householdId === householdId ? <span className="type-meta">Current</span> : <ChevronRightIcon className="size-4 text-muted-foreground" />}
          </button>
        ))}
      </div>
    </section>
  )
}

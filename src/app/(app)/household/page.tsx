import { InviteManager } from "@/components/invite-manager"
import { NotificationEnablement } from "@/components/notification-enablement"
import { RenameHouseholdForm } from "@/components/rename-household-form"
import {
  LeaveHouseholdButton,
  RemoveMemberButton,
  SignOutButton,
} from "@/components/household-actions"
import { getSessionHousehold } from "@/lib/household/session"
import { createClient } from "@/lib/supabase/server"
import type { HouseholdRole } from "@/lib/supabase/database.types"

type MemberRow = {
  user_id: string
  role: HouseholdRole
  profiles: { display_name: string } | { display_name: string }[] | null
}

type InviteRow = {
  id: string
  expires_at: string
  revoked_at: string | null
}

export default async function HouseholdPage() {
  const { userId, household } = await getSessionHousehold()
  if (!userId || household.status !== "ready") {
    return null
  }

  const current = household.current
  const supabase = await createClient()
  const isOwner = current.role === "owner"

  const [membersResult, invitesResult] = await Promise.all([
    supabase
      .from("household_members")
      .select("user_id, role, joined_at, profiles(display_name)")
      .eq("household_id", current.householdId)
      .order("joined_at", { ascending: true }),
    isOwner
      ? supabase
          .from("household_invites")
          .select("id, expires_at, revoked_at")
          .eq("household_id", current.householdId)
          .order("expires_at", { ascending: false })
      : Promise.resolve({ data: [] as InviteRow[] }),
  ])
  const members = (membersResult.data ?? []) as MemberRow[]
  const invites = (invitesResult.data ?? []) as InviteRow[]

  return (
    <section className="flex flex-col gap-8 px-4 py-2">
      <div className="flex flex-col gap-2">
        <h1 className="text-lg font-medium tracking-tight">Household</h1>
        <p className="text-sm text-muted-foreground">{current.householdName}</p>
      </div>

      {isOwner ? (
        <RenameHouseholdForm
          householdId={current.householdId}
          currentName={current.householdName}
        />
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Members</h2>
        <ul className="flex flex-col">
          {members.map((member) => {
            const profile = Array.isArray(member.profiles)
              ? member.profiles[0]
              : member.profiles
            const isSelf = member.user_id === userId
            return (
              <li
                key={member.user_id}
                className="flex items-center justify-between gap-3 border-b border-border py-2 text-sm"
              >
                <div className="flex flex-col gap-0.5">
                  <span>{profile?.display_name ?? "Member"}</span>
                  <span className="text-xs text-muted-foreground">
                    {member.role}
                    {isSelf ? " · you" : ""}
                  </span>
                </div>
                {isOwner && !isSelf ? (
                  <RemoveMemberButton
                    householdId={current.householdId}
                    userId={member.user_id}
                  />
                ) : null}
              </li>
            )
          })}
        </ul>
      </section>

      {isOwner ? (
        <InviteManager
          householdId={current.householdId}
          invites={invites}
        />
      ) : null}

      <NotificationEnablement variant="household" />

      <div className="flex flex-col gap-2">
        <LeaveHouseholdButton householdId={current.householdId} />
        <SignOutButton />
      </div>
    </section>
  )
}

"use client"

import { InviteManager } from "@/components/invite-manager"
import { NotificationEnablement } from "@/components/notification-enablement"
import { RenameHouseholdForm } from "@/components/rename-household-form"
import {
  LeaveHouseholdButton,
  RemoveMemberButton,
  SignOutButton,
} from "@/components/household-actions"
import {
  useAppSession,
  type HouseholdInvite,
  type HouseholdMember,
} from "@/lib/app-session"

export function HouseholdTab({
  initialMembers,
  initialInvites,
}: {
  initialMembers?: HouseholdMember[]
  initialInvites?: HouseholdInvite[]
}) {
  const {
    userId,
    householdId,
    householdName,
    role,
    members,
    invites,
    refreshHousehold,
    setHouseholdName,
  } = useAppSession()

  const memberRows = members ?? initialMembers ?? []
  const inviteRows = invites ?? initialInvites ?? []
  const isOwner = role === "owner"

  return (
    <section className="flex flex-col gap-8 px-4 py-2">
      <div className="flex flex-col gap-2">
        <h1 className="text-lg font-medium tracking-tight">Household</h1>
        <p className="text-sm text-muted-foreground">{householdName}</p>
      </div>

      {isOwner ? (
        <RenameHouseholdForm
          householdId={householdId}
          currentName={householdName}
          onRenamed={(name) => {
            setHouseholdName(name)
            void refreshHousehold()
          }}
        />
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Members</h2>
        <ul className="flex flex-col">
          {memberRows.map((member) => {
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
                    householdId={householdId}
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
          householdId={householdId}
          invites={inviteRows}
          onChanged={() => {
            void refreshHousehold()
          }}
        />
      ) : null}

      <NotificationEnablement variant="household" />

      <div className="flex flex-col gap-2">
        <LeaveHouseholdButton householdId={householdId} />
        <SignOutButton />
      </div>
    </section>
  )
}

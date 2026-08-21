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
    <section className="flex flex-col gap-6 px-4 py-2">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="type-display">{householdName}</h1>
          <p className="mt-1 type-body-secondary">{memberRows.length} {memberRows.length === 1 ? "member" : "members"}</p>
        </div>
        <span className="type-meta">{isOwner ? "Owner" : "Member"}</span>
      </div>

      {isOwner ? (
        <details className="rounded-xl border bg-card px-4 py-3">
          <summary className="cursor-pointer list-none type-body">Rename household</summary>
          <div className="pt-4">
            <RenameHouseholdForm
              householdId={householdId}
              currentName={householdName}
              onRenamed={(name) => {
                setHouseholdName(name)
                void refreshHousehold()
              }}
            />
          </div>
        </details>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="type-section">Members</h2>
        <ul className="flex flex-col rounded-xl border bg-card px-3">
          {memberRows.map((member) => {
            const profile = Array.isArray(member.profiles)
              ? member.profiles[0]
              : member.profiles
            const isSelf = member.user_id === userId
            return (
              <li
                key={member.user_id}
                className="flex items-center justify-between gap-3 border-b border-border py-3.5 text-sm last:border-b-0"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">{profile?.display_name ?? "Member"}</span>
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

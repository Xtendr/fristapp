import { HouseholdTab } from "@/components/household-tab"
import type { HouseholdInvite, HouseholdMember } from "@/lib/app-session"
import { getSessionHousehold } from "@/lib/household/session"
import { createClient } from "@/lib/supabase/server"

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
      : Promise.resolve({ data: [] as HouseholdInvite[] }),
  ])

  return (
    <HouseholdTab
      initialMembers={(membersResult.data ?? []) as HouseholdMember[]}
      initialInvites={(invitesResult.data ?? []) as HouseholdInvite[]}
    />
  )
}

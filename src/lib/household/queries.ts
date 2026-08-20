import { createClient } from "@/lib/supabase/server"
import type { HouseholdRole } from "@/lib/supabase/database.types"

export type Membership = {
  householdId: string
  householdName: string
  role: HouseholdRole
}

type MembershipRow = {
  household_id: string
  role: HouseholdRole
  households: { name: string } | { name: string }[] | null
}

export async function getUserId() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  if (error || !data?.claims?.sub) {
    return null
  }
  return data.claims.sub
}

export async function getMemberships(): Promise<Membership[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("household_members")
    .select("household_id, role, households(name)")
    .order("joined_at", { ascending: true })

  if (error || !data) {
    return []
  }

  return (data as unknown as MembershipRow[]).flatMap((row) => {
    const household = Array.isArray(row.households)
      ? row.households[0]
      : row.households
    if (!household?.name) {
      return []
    }
    return [
      {
        householdId: row.household_id,
        householdName: household.name,
        role: row.role,
      },
    ]
  })
}

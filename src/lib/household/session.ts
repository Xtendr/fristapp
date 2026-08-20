import { cache } from "react"

import { getHouseholdCookie } from "@/lib/household/cookie"
import {
  getMemberships,
  getUserId,
  type Membership,
} from "@/lib/household/queries"

export function resolveHousehold(
  memberships: Membership[],
  cookieId: string | null
) {
  if (memberships.length === 0) {
    return { status: "none" as const }
  }

  if (memberships.length === 1) {
    return { status: "ready" as const, current: memberships[0], memberships }
  }

  const selected = memberships.find((item) => item.householdId === cookieId)
  if (selected) {
    return { status: "ready" as const, current: selected, memberships }
  }

  return { status: "choose" as const, memberships }
}

export type HouseholdResolution = ReturnType<typeof resolveHousehold>

export type SessionHousehold =
  | { userId: null; household: null }
  | { userId: string; household: HouseholdResolution }

export const getSessionHousehold = cache(
  async (): Promise<SessionHousehold> => {
    const userId = await getUserId()
    if (!userId) {
      return { userId: null, household: null }
    }

    const memberships = await getMemberships()
    const cookieId = await getHouseholdCookie()
    return {
      userId,
      household: resolveHousehold(memberships, cookieId),
    }
  }
)

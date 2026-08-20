import { cookies } from "next/headers"

import { HOUSEHOLD_COOKIE } from "@/lib/paths"

export async function getHouseholdCookie() {
  const store = await cookies()
  return store.get(HOUSEHOLD_COOKIE)?.value ?? null
}

export async function setHouseholdCookie(householdId: string) {
  const store = await cookies()
  store.set(HOUSEHOLD_COOKIE, householdId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  })
}

export async function clearHouseholdCookie() {
  const store = await cookies()
  store.delete(HOUSEHOLD_COOKIE)
}

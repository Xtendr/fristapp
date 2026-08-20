import { redirect } from "next/navigation"

import { getSessionHousehold } from "@/lib/household/session"

export const dynamic = "force-dynamic"

export default async function SetupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { userId, household } = await getSessionHousehold()
  if (!userId) {
    redirect("/sign-in")
  }
  if (household.status !== "none") {
    redirect("/")
  }

  return children
}

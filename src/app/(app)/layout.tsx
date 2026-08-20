import { redirect } from "next/navigation"

import { AppShell } from "@/components/app-shell"
import { getSessionHousehold } from "@/lib/household/session"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { userId, household } = await getSessionHousehold()
  if (!userId) {
    redirect("/sign-in")
  }
  if (household.status === "none") {
    redirect("/setup")
  }
  if (household.status === "choose") {
    redirect("/select-household")
  }

  return (
    <AppShell householdName={household.current.householdName}>
      {children}
    </AppShell>
  )
}

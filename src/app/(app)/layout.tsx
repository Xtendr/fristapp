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
    <AppShell
      userId={userId}
      householdId={household.current.householdId}
      householdName={household.current.householdName}
      role={household.current.role}
    >
      {children}
    </AppShell>
  )
}

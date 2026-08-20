import { redirect } from "next/navigation"

import { AuthChrome } from "@/components/auth-chrome"
import { SelectHouseholdButton } from "@/components/household-actions"
import { getSessionHousehold } from "@/lib/household/session"

export const dynamic = "force-dynamic"

export default async function SelectHouseholdPage() {
  const { userId, household } = await getSessionHousehold()
  if (!userId) {
    redirect("/sign-in")
  }
  if (household.status === "none") {
    redirect("/setup")
  }
  if (household.status === "ready") {
    redirect("/")
  }

  return (
    <AuthChrome
      title="Choose a household"
      description="You belong to more than one household. This choice stays on this device."
    >
      <div className="flex flex-col gap-2">
        {household.memberships.map((item) => (
          <SelectHouseholdButton
            key={item.householdId}
            householdId={item.householdId}
            name={item.householdName}
          />
        ))}
      </div>
    </AuthChrome>
  )
}

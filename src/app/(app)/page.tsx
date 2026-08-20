import { HomeTab } from "@/components/home-tab"
import { getAttentionInventory } from "@/lib/inventory/queries"
import { getSessionHousehold } from "@/lib/household/session"

export default async function HomePage() {
  const { household } = await getSessionHousehold()
  if (household?.status !== "ready") {
    return null
  }

  const items = await getAttentionInventory(household.current.householdId)

  return <HomeTab initialItems={items} />
}

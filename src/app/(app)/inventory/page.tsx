import { InventoryTab } from "@/components/inventory-tab"
import { getHouseholdInventory } from "@/lib/inventory/queries"
import { getSessionHousehold } from "@/lib/household/session"

export default async function InventoryPage() {
  const { household } = await getSessionHousehold()
  if (household?.status !== "ready") {
    return null
  }

  const items = await getHouseholdInventory(household.current.householdId)

  return <InventoryTab initialItems={items} />
}

import Link from "next/link"

import { InventoryRow } from "@/components/inventory-row"
import { buttonVariants } from "@/components/ui/button"
import { getHouseholdInventory } from "@/lib/inventory/queries"
import { getSessionHousehold } from "@/lib/household/session"
import { cn } from "@/lib/utils"

export default async function InventoryPage() {
  const { household } = await getSessionHousehold()
  if (household?.status !== "ready") {
    return null
  }

  const items = await getHouseholdInventory(household.current.householdId)

  return (
    <section className="flex flex-col gap-6 px-4 py-2">
      <div className="flex items-end justify-between gap-3">
        <h1 className="text-lg font-medium tracking-tight">Inventory</h1>
        <Link
          href="/add"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Add
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="text-sm leading-6 text-muted-foreground">
          No food in this household yet.
        </p>
      ) : (
        <ul className="flex flex-col">
          {items.map((item) => (
            <li key={item.id}>
              <InventoryRow item={item} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

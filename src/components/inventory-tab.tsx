"use client"

import { InventoryRow } from "@/components/inventory-row"
import { buttonVariants } from "@/components/ui/button"
import { useAppSession } from "@/lib/app-session"
import type { InventoryItem } from "@/lib/inventory/item"
import { cn } from "@/lib/utils"

export function InventoryTab({
  initialItems,
}: {
  initialItems?: InventoryItem[]
}) {
  const { inventory, navigateTab } = useAppSession()
  const items = inventory ?? initialItems ?? []

  return (
    <section className="flex flex-col gap-6 px-4 py-2">
      <div className="flex items-end justify-between gap-3">
        <h1 className="text-lg font-medium tracking-tight">Inventory</h1>
        <button
          type="button"
          onClick={() => navigateTab("/add")}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Add
        </button>
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

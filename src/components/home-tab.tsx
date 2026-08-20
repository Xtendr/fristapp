"use client"

import { AttentionList } from "@/components/attention-list"
import { NotificationEnablement } from "@/components/notification-enablement"
import { useAppSession } from "@/lib/app-session"
import type { InventoryItem } from "@/lib/inventory/item"

export function HomeTab({ initialItems }: { initialItems?: InventoryItem[] }) {
  const { inventory, navigateTab } = useAppSession()
  const items = inventory ?? initialItems ?? []

  return (
    <section className="flex flex-col gap-6 px-4 py-2">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-medium tracking-tight">Home</h1>
        <p className="text-sm text-muted-foreground">Needs attention</p>
      </div>
      <NotificationEnablement variant="home" />
      <AttentionList items={items} />
      <button
        type="button"
        onClick={() => navigateTab("/inventory")}
        className="text-left text-sm text-foreground underline-offset-4 hover:underline"
      >
        View inventory
      </button>
    </section>
  )
}

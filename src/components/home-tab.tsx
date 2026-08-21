"use client"

import { AttentionList } from "@/components/attention-list"
import { NotificationEnablement } from "@/components/notification-enablement"
import { useAppSession } from "@/lib/app-session"
import type { InventoryItem } from "@/lib/inventory/item"
import { classifyExpiry } from "@/lib/inventory/expiry"

export function HomeTab({ initialItems }: { initialItems?: InventoryItem[] }) {
  const { inventory, navigateTab } = useAppSession()
  const items = inventory ?? initialItems ?? []
  const attentionCount = items.filter((item) => {
    const bucket = classifyExpiry(item.expiryDate)
    return bucket !== "later"
  }).length
  const today = new Intl.DateTimeFormat("da-DK", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Copenhagen",
  }).format(new Date())

  return (
    <section className="flex flex-col gap-6 px-4 py-2">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="type-display">Use first</h1>
          <p className="mt-1 capitalize type-meta">{today}</p>
        </div>
        <p className="type-meta-num">{attentionCount} need attention</p>
      </div>
      <NotificationEnablement variant="home" />
      <AttentionList items={items} />
      <button
        type="button"
        onClick={() => navigateTab("/inventory")}
        className="text-left text-sm font-medium text-foreground underline-offset-4 hover:underline"
      >
        View all inventory →
      </button>
    </section>
  )
}

import { InventoryRow } from "@/components/inventory-row"
import { classifyExpiry } from "@/lib/inventory/expiry"
import type { InventoryItem } from "@/lib/inventory/item"

const attentionOrder = ["expired", "today", "tomorrow", "soon"] as const

const attentionTitles = {
  expired: "Expired",
  today: "Today",
  tomorrow: "Tomorrow",
  soon: "Soon",
} as const

export function AttentionList({ items }: { items: InventoryItem[] }) {
  const grouped = new Map<(typeof attentionOrder)[number], InventoryItem[]>()
  for (const bucket of attentionOrder) {
    grouped.set(bucket, [])
  }
  for (const item of items) {
    const bucket = classifyExpiry(item.expiryDate)
    if (bucket === "later") {
      continue
    }
    grouped.get(bucket)?.push(item)
  }

  const sections = attentionOrder.filter(
    (bucket) => (grouped.get(bucket)?.length ?? 0) > 0
  )

  if (sections.length === 0) {
    return (
      <p className="text-sm leading-6 text-muted-foreground">
        Nothing needs attention.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {sections.map((bucket) => (
        <section key={bucket} className="flex flex-col">
          <h2 className="mb-2 type-section">{attentionTitles[bucket]}</h2>
          <ul className="flex flex-col rounded-xl border bg-card px-3">
            {(grouped.get(bucket) ?? []).map((item) => (
              <li key={item.id}>
                <InventoryRow item={item} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

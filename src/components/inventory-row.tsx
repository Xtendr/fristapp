import Link from "next/link"

import {
  classifyExpiry,
  formatDisplayDate,
  relativeExpiryLabel,
  storageLabel,
  type ExpiryBucket,
} from "@/lib/inventory/expiry"
import type { InventoryItem } from "@/lib/inventory/queries"
import { cn } from "@/lib/utils"

function expiryClass(bucket: ExpiryBucket) {
  if (bucket === "expired") {
    return "text-[var(--status-expired)]"
  }
  if (bucket === "today" || bucket === "tomorrow") {
    return "text-[var(--status-urgent)]"
  }
  if (bucket === "soon") {
    return "text-[var(--status-soon)]"
  }
  return "text-muted-foreground"
}

export function InventoryRow({ item }: { item: InventoryItem }) {
  const bucket = classifyExpiry(item.expiryDate)

  return (
    <Link
      href={`/inventory/${item.id}/edit`}
      className="flex items-baseline justify-between gap-3 border-b border-border py-3 text-sm"
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate font-medium">
          {item.displayName}
          {item.quantity > 1 ? (
            <span className="ml-1 font-normal text-muted-foreground">
              ×{item.quantity}
            </span>
          ) : null}
        </span>
        <span className="text-xs text-muted-foreground">
          {storageLabel(item.storageLocation)}
        </span>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <span className={cn("text-sm", expiryClass(bucket))}>
          {relativeExpiryLabel(item.expiryDate)}
        </span>
        <span className="text-xs text-muted-foreground">
          {formatDisplayDate(item.expiryDate)}
        </span>
      </div>
    </Link>
  )
}

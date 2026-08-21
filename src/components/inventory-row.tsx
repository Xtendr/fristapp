import Link from "next/link"
import { ChevronRightIcon } from "lucide-react"

import {
  classifyExpiry,
  formatDisplayDate,
  relativeExpiryLabel,
  storageLabel,
  type ExpiryBucket,
} from "@/lib/inventory/expiry"
import type { InventoryItem } from "@/lib/inventory/item"
import { cn } from "@/lib/utils"

function expiryClass(bucket: ExpiryBucket) {
  if (bucket === "expired") {
    return "text-status-expired"
  }
  if (bucket === "today") {
    return "text-status-today"
  }
  if (bucket === "tomorrow") {
    return "text-status-tomorrow"
  }
  if (bucket === "soon") {
    return "text-status-soon"
  }
  return "text-muted-foreground"
}

export function InventoryRow({ item }: { item: InventoryItem }) {
  const bucket = classifyExpiry(item.expiryDate)

  return (
    <Link
      href={`/inventory/${item.id}/edit`}
      className="group flex min-h-16 touch-manipulation items-center justify-between gap-3 border-b border-border py-3 text-sm transition-colors last:border-b-0 hover:bg-muted/60 active:bg-muted"
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate font-medium">
          {item.displayName}
          {item.quantity > 1 ? (
            <span className="ml-1 font-normal text-muted-foreground tabular-nums">
              ×{item.quantity}
            </span>
          ) : null}
        </span>
        <span className="text-xs text-muted-foreground">
          {storageLabel(item.storageLocation)}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <div className="flex flex-col items-end gap-0.5">
          <span className={cn("text-sm", expiryClass(bucket))}>
            {relativeExpiryLabel(item.expiryDate)}
          </span>
          <span className="type-meta-num">
            {formatDisplayDate(item.expiryDate)}
          </span>
        </div>
        <ChevronRightIcon className="size-4 text-muted-foreground transition-transform group-active:translate-x-0.5" aria-hidden="true" />
      </div>
    </Link>
  )
}

"use client"

import { useRef, useState } from "react"
import { ChevronRightIcon, Trash2Icon } from "lucide-react"
import { CategoryIcon } from "@/lib/categories/icons"

import { Button } from "@/components/ui/button"
import { useOptionalAppSession } from "@/lib/app-session"

import {
  classifyExpiry,
  formatDisplayDate,
  relativeExpiryLabel,
  storageLabel,
  type ExpiryBucket,
} from "@/lib/inventory/expiry"
import type { InventoryItem } from "@/lib/inventory/item"
import {
  SWIPE_ACTION_WIDTH,
  clampSwipeOffset,
  resolveSwipeAxis,
  shouldRevealSwipe,
  type SwipeAxis,
} from "@/lib/inventory/swipe"
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

export function InventoryRow({
  item,
  revealed = false,
  onReveal,
  onCloseReveal,
  onOpen,
  onRemove,
}: {
  item: InventoryItem
  revealed?: boolean
  onReveal?: () => void
  onCloseReveal?: () => void
  onOpen?: () => void
  onRemove?: () => void
}) {
  const session = useOptionalAppSession()
  const bucket = classifyExpiry(item.expiryDate)
  const settledOffset = revealed ? -SWIPE_ACTION_WIDTH : 0
  const [drag, setDrag] = useState<{
    offset: number
    baseRevealed: boolean
  } | null>(null)
  const offset = drag?.baseRevealed === revealed ? drag.offset : settledOffset
  const offsetRef = useRef(offset)
  const suppressClick = useRef(false)
  const gesture = useRef<{
    pointerId: number
    startX: number
    startY: number
    axis: SwipeAxis
    moved: boolean
  } | null>(null)

  function updateOffset(next: number) {
    offsetRef.current = next
    setDrag({ offset: next, baseRevealed: revealed })
  }

  function finishGesture() {
    if (!gesture.current) return
    if (gesture.current.axis === "horizontal") {
      if (shouldRevealSwipe(offsetRef.current)) {
        onReveal?.()
        updateOffset(-SWIPE_ACTION_WIDTH)
      } else {
        onCloseReveal?.()
        updateOffset(0)
      }
    }
  }

  return (
    <div className="relative overflow-hidden bg-destructive/10">
      {onRemove ? (
        <Button
          type="button"
          variant="destructive"
          className="absolute inset-y-0 right-0 h-full w-20 rounded-none"
          onClick={onRemove}
          aria-label={`Remove ${item.displayName}`}
        >
          <Trash2Icon data-icon="inline-start" aria-hidden="true" />
          Remove
        </Button>
      ) : null}
      <button
        type="button"
        draggable={false}
        onContextMenu={(event) => event.preventDefault()}
        onPointerDown={(event) => {
          if (!event.isPrimary || !onRemove) return
          suppressClick.current = false
          offsetRef.current = settledOffset
          gesture.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            axis: null,
            moved: false,
          }
        }}
        onPointerMove={(event) => {
          const current = gesture.current
          if (!current || current.pointerId !== event.pointerId) return
          const deltaX = event.clientX - current.startX
          const deltaY = event.clientY - current.startY
          current.axis ??= resolveSwipeAxis(deltaX, deltaY)
          if (current.axis !== "horizontal") return
          current.moved = true
          suppressClick.current = true
          updateOffset(clampSwipeOffset(deltaX, revealed))
        }}
        onPointerUp={(event) => {
          if (gesture.current?.pointerId !== event.pointerId) return
          finishGesture()
          gesture.current = null
        }}
        onPointerCancel={() => {
          updateOffset(revealed ? -SWIPE_ACTION_WIDTH : 0)
          gesture.current = null
        }}
        onClick={(event) => {
          if (suppressClick.current) {
            suppressClick.current = false
            event.preventDefault()
            return
          }
          if (revealed) {
            onCloseReveal?.()
            return
          }
          if (onOpen) {
            onOpen()
          } else {
            session?.openInventoryItem(item)
          }
        }}
        aria-label={`Edit ${item.displayName}`}
        aria-expanded={revealed}
        className="group relative flex min-h-16 w-full touch-pan-y select-none items-center justify-between gap-3 bg-card px-3 py-3 text-left text-sm transition-[transform,background-color] duration-150 [-webkit-touch-callout:none] hover:bg-muted/60 active:bg-muted"
        style={{ transform: `translateX(${offset}px)` }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <CategoryIcon iconKey={item.category?.iconKey ?? "shapes"} className="size-4" />
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate font-medium">
            {item.displayName}
            {item.quantity > 1 ? (
              <span className="ml-1 font-normal text-muted-foreground tabular-nums">
                ×{item.quantity}
              </span>
            ) : null}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {item.category?.name ?? "Other"} · {storageLabel(item.storageLocation)}
          </span>
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
      </button>
    </div>
  )
}

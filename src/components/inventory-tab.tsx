"use client"

import { useState } from "react"
import { SearchIcon } from "lucide-react"

import { InventoryRow } from "@/components/inventory-row"
import { useAppSession } from "@/lib/app-session"
import type { InventoryItem } from "@/lib/inventory/item"
import { cn } from "@/lib/utils"
import type { StorageLocation } from "@/lib/supabase/database.types"

type Filter = "all" | StorageLocation

export function InventoryTab({
  initialItems,
}: {
  initialItems?: InventoryItem[]
}) {
  const { inventory, navigateTab } = useAppSession()
  const items = inventory ?? initialItems ?? []
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<Filter>("all")
  const normalizedQuery = query.trim().toLocaleLowerCase("da-DK")
  const visibleItems = items.filter((item) =>
    (filter === "all" || item.storageLocation === filter) &&
    (!normalizedQuery || item.displayName.toLocaleLowerCase("da-DK").includes(normalizedQuery))
  )

  return (
    <section className="flex flex-col gap-5 px-4 py-2">
      <div className="flex items-end justify-between gap-3">
        <h1 className="type-display">Inventory</h1>
        <p className="type-meta-num">{items.length} {items.length === 1 ? "item" : "items"}</p>
      </div>
      <label className="flex h-11 items-center gap-2 rounded-lg bg-muted px-3 text-muted-foreground focus-within:ring-2 focus-within:ring-ring/30">
        <SearchIcon className="size-4" />
        <span className="sr-only">Search inventory</span>
        <input className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search inventory" />
      </label>
      <div className="flex gap-1" aria-label="Filter inventory by storage">
        {(["all", "fridge", "freezer", "pantry"] as const).map((value) => (
          <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={cn("min-h-11 touch-manipulation rounded-lg px-3 text-sm capitalize text-muted-foreground transition-colors hover:bg-muted", filter === value && "bg-primary text-primary-foreground hover:bg-primary")}>{value}</button>
        ))}
      </div>
      {items.length === 0 ? (
        <p className="text-sm leading-6 text-muted-foreground">
          No food in this household yet.
          <button type="button" className="ml-1 font-medium text-foreground" onClick={() => navigateTab("/add")}>Add the first item.</button>
        </p>
      ) : visibleItems.length === 0 ? (
        <p className="type-body-secondary">No items match this search.</p>
      ) : (
        <ul className="flex flex-col rounded-xl border bg-card px-3">
          {visibleItems.map((item) => (
            <li key={item.id}>
              <InventoryRow item={item} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

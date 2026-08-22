"use client"

import { useState } from "react"
import { SearchIcon, TagsIcon, XIcon } from "lucide-react"
import { toast } from "sonner"

import { InventoryRow } from "@/components/inventory-row"
import { useAppSession } from "@/lib/app-session"
import { deleteInventoryItem } from "@/lib/inventory/actions"
import type { InventoryItem } from "@/lib/inventory/item"
import { cn } from "@/lib/utils"
import type { StorageLocation } from "@/lib/supabase/database.types"

type Filter = "all" | StorageLocation

export function InventoryTab({
  initialItems,
}: {
  initialItems?: InventoryItem[]
}) {
  const {
    inventory,
    navigateTab,
    openInventoryItem,
    removeInventoryItem,
    addInventoryItem,
    categories: sessionCategories,
  } = useAppSession()
  const items = inventory ?? initialItems ?? []
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<Filter>("all")
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [revealedItemId, setRevealedItemId] = useState<string | null>(null)
  const normalizedQuery = query.trim().toLocaleLowerCase("da-DK")
  const categories = sessionCategories ?? []
  const activeCategory = categories.find((category) => category.id === categoryId)
  const visibleItems = items.filter((item) =>
    (filter === "all" || item.storageLocation === filter) &&
    (!categoryId || item.category?.id === categoryId) &&
    (!normalizedQuery || item.displayName.toLocaleLowerCase("da-DK").includes(normalizedQuery))
  )

  async function removeItem(item: InventoryItem) {
    setRevealedItemId(null)
    removeInventoryItem(item.id)

    const result = await deleteInventoryItem(item.id)
    if ("error" in result) {
      addInventoryItem(item)
      toast.error("The item could not be removed. It has been restored.")
      return
    }

    toast.success(`${item.displayName} removed.`)
  }

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
      <div className="flex items-center gap-2">
        <label className="relative inline-flex min-h-10 items-center gap-2 rounded-lg border bg-background px-3 text-sm font-medium">
          <TagsIcon className="size-4 text-muted-foreground" />
          <span>{activeCategory ? "Change category" : "Category"}</span>
          <select aria-label="Filter inventory by category" value={categoryId ?? ""} onChange={(event) => setCategoryId(event.target.value || null)} className="absolute inset-0 cursor-pointer opacity-0">
            <option value="">All categories</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
        {activeCategory ? (
          <button type="button" onClick={() => setCategoryId(null)} className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-muted px-3 text-xs font-medium">
            {activeCategory.name}<XIcon className="size-3.5" />
          </button>
        ) : null}
      </div>
      {items.length === 0 ? (
        <p className="text-sm leading-6 text-muted-foreground">
          No food in this household yet.
          <button type="button" className="ml-1 font-medium text-foreground" onClick={() => navigateTab("/add")}>Add the first item.</button>
        </p>
      ) : visibleItems.length === 0 ? (
        <p className="type-body-secondary">No items match this search.</p>
      ) : (
        <ul className="flex flex-col overflow-hidden rounded-xl border bg-card">
          {visibleItems.map((item) => (
            <li key={item.id} className="border-b border-border last:border-b-0">
              <InventoryRow
                item={item}
                revealed={revealedItemId === item.id}
                onReveal={() => setRevealedItemId(item.id)}
                onCloseReveal={() => setRevealedItemId(null)}
                onOpen={() => openInventoryItem(item)}
                onRemove={() => void removeItem(item)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

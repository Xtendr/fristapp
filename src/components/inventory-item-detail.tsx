"use client"

import { ArrowLeftIcon } from "lucide-react"

import { InventoryItemForm } from "@/components/inventory-item-form"
import { Button } from "@/components/ui/button"
import { useAppSession } from "@/lib/app-session"
import type { InventoryItem } from "@/lib/inventory/item"

export function InventoryItemDetail({ item }: { item: InventoryItem }) {
  const { closeInventoryItem } = useAppSession()

  return (
    <section className="animate-in fade-in slide-in-from-right-3 flex flex-col gap-5 px-4 py-2 duration-150">
      <div className="flex flex-col gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-3 w-fit text-muted-foreground"
          onClick={closeInventoryItem}
        >
          <ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
          Inventory
        </Button>
        <h1 className="type-display">Edit item</h1>
      </div>
      <InventoryItemForm
        mode="edit"
        itemId={item.id}
        initialValues={{
          displayName: item.displayName,
          expiryDate: item.expiryDate,
          expiryType: item.expiryType ?? "unknown",
          storageLocation: item.storageLocation,
          quantity: item.quantity,
          categoryId: item.category?.id ?? "",
        }}
      />
      <p className="type-meta px-1">Added by {item.addedBy?.name ?? "Household member"}</p>
    </section>
  )
}

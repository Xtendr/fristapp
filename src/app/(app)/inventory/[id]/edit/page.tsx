import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeftIcon } from "lucide-react"

import { InventoryItemForm } from "@/components/inventory-item-form"
import { getInventoryItem } from "@/lib/inventory/queries"
import { getSessionHousehold } from "@/lib/household/session"

export default async function EditInventoryItemPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { household } = await getSessionHousehold()
  if (household?.status !== "ready") {
    return null
  }

  const item = await getInventoryItem(household.current.householdId, id)
  if (!item) {
    notFound()
  }

  return (
    <section className="flex flex-col gap-5 px-4 py-2">
      <div className="flex flex-col gap-1">
        <Link href="/inventory" className="flex min-h-11 w-fit touch-manipulation items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon className="size-4" aria-hidden="true" />Inventory
        </Link>
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
    </section>
  )
}

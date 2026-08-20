import { notFound } from "next/navigation"

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
    <section className="flex flex-col gap-6 px-4 py-2">
      <h1 className="text-lg font-medium tracking-tight">Edit item</h1>
      <InventoryItemForm
        mode="edit"
        itemId={item.id}
        initialValues={{
          displayName: item.displayName,
          expiryDate: item.expiryDate,
          storageLocation: item.storageLocation,
          quantity: item.quantity,
        }}
      />
    </section>
  )
}

import { InventoryItemForm } from "@/components/inventory-item-form"

export default function AddPage() {
  return (
    <section className="flex flex-col gap-6 px-4 py-2">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-medium tracking-tight">Add</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Manual entry. Scan, photo, and batch come later.
        </p>
      </div>
      <InventoryItemForm mode="create" />
    </section>
  )
}

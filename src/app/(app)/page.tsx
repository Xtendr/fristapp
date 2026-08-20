import Link from "next/link"

import { AttentionList } from "@/components/attention-list"
import { NotificationEnablement } from "@/components/notification-enablement"
import { getAttentionInventory } from "@/lib/inventory/queries"
import { getSessionHousehold } from "@/lib/household/session"

export default async function HomePage() {
  const { household } = await getSessionHousehold()
  if (household?.status !== "ready") {
    return null
  }

  const items = await getAttentionInventory(household.current.householdId)

  return (
    <section className="flex flex-col gap-6 px-4 py-2">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-medium tracking-tight">Home</h1>
        <p className="text-sm text-muted-foreground">Needs attention</p>
      </div>
      <NotificationEnablement variant="home" />
      <AttentionList items={items} />
      <Link
        href="/inventory"
        className="text-sm text-foreground underline-offset-4 hover:underline"
      >
        View inventory
      </Link>
    </section>
  )
}

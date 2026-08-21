"use client"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { storageLabel } from "@/lib/inventory/expiry"
import { storageLocations } from "@/lib/inventory/schema"
import type { StorageLocation } from "@/lib/supabase/database.types"

export function StorageLocationPicker({
  name,
  value,
  onChange,
}: {
  name: string
  value: StorageLocation
  onChange: (value: StorageLocation) => void
}) {
  return (
    <>
      <input type="hidden" name={name} value={value} />
      <ToggleGroup
        value={[value]}
        onValueChange={(next) => {
          const location = next[0] as StorageLocation | undefined
          if (location) onChange(location)
        }}
        className="grid w-full grid-cols-3 gap-2"
        aria-label="Storage location"
      >
        {storageLocations.map((location) => (
          <ToggleGroupItem
            key={location}
            value={location}
            variant="outline"
            className="h-11 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
          >
            {storageLabel(location)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </>
  )
}

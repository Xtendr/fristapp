"use client"

import { CategoryIcon } from "@/lib/categories/icons"
import type { HouseholdCategory } from "@/lib/categories/types"

export function CategoryPicker({
  categories,
  value,
  onChange,
  name = "categoryId",
  id = "categoryId",
  disabled = false,
}: {
  categories: HouseholdCategory[]
  value: string
  onChange: (categoryId: string) => void
  name?: string
  id?: string
  disabled?: boolean
}) {
  const selected = categories.find((category) => category.id === value)

  return (
    <div className="relative">
      {selected ? (
        <CategoryIcon
          iconKey={selected.iconKey}
          className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground"
        />
      ) : null}
      <select
        id={id}
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        required
        className="h-10 w-full appearance-none rounded-lg border border-input bg-background py-2 pl-9 pr-8 text-sm outline-none transition-shadow focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>
      <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">⌄</span>
    </div>
  )
}

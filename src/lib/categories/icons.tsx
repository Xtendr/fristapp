import {
  Apple,
  Beef,
  Cookie,
  CupSoda,
  Milk,
  Package,
  Shapes,
  Soup,
  Utensils,
  Wheat,
  type LucideIcon,
} from "lucide-react"

import type { CategoryIconKey } from "@/lib/supabase/database.types"

export const CATEGORY_ICONS: Record<CategoryIconKey, LucideIcon> = {
  milk: Milk,
  apple: Apple,
  drumstick: Beef,
  wheat: Wheat,
  utensils: Utensils,
  cup: CupSoda,
  package: Package,
  bottle: Soup,
  cookie: Cookie,
  shapes: Shapes,
}

export const CATEGORY_ICON_OPTIONS = Object.keys(CATEGORY_ICONS) as CategoryIconKey[]

export function CategoryIcon({
  iconKey,
  className,
}: {
  iconKey: CategoryIconKey
  className?: string
}) {
  const Icon = CATEGORY_ICONS[iconKey]
  return <Icon aria-hidden="true" className={className} />
}

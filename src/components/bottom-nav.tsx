"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { HouseIcon, PackageIcon, PlusIcon, UsersIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Provisional foundation navigation only.
 * Four tabs, including Add, are not a committed information architecture.
 * Add may become a central action instead of a destination once real flows exist.
 */
const items = [
  { href: "/", label: "Home", icon: HouseIcon },
  { href: "/inventory", label: "Inventory", icon: PackageIcon },
  { href: "/add", label: "Add", icon: PlusIcon },
  { href: "/household", label: "Household", icon: UsersIcon },
] as const

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 border-t border-border bg-background"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-4 px-2 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {items.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href)
          const Icon = item.icon

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex min-h-12 flex-col items-center justify-center gap-0.5 text-[11px] tracking-wide",
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className="size-4" strokeWidth={isActive ? 2.25 : 1.75} />
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

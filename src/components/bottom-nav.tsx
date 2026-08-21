"use client"

import { HouseIcon, PackageIcon, PlusIcon, UsersIcon } from "lucide-react"
import { usePathname } from "next/navigation"

import { useAppSession } from "@/lib/app-session"
import type { AppTabHref } from "@/lib/app-tabs"
import { cn } from "@/lib/utils"

const items = [
  { href: "/", label: "Home", icon: HouseIcon },
  { href: "/inventory", label: "Inventory", icon: PackageIcon },
  { href: "/add", label: "Add", icon: PlusIcon },
  { href: "/household", label: "Household", icon: UsersIcon },
] as const satisfies readonly {
  href: AppTabHref
  label: string
  icon: typeof HouseIcon
}[]

export function BottomNav() {
  const pathname = usePathname()
  const { navigateTab, activeTab } = useAppSession()
  const currentPath = activeTab ?? pathname

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-20 isolate border-t border-border bg-background/95 backdrop-blur-md"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-4 px-2 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {items.map((item) => {
          const isActive =
            item.href === "/"
              ? currentPath === "/"
              : currentPath.startsWith(item.href)
          const Icon = item.icon

          return (
            <li key={item.href} className="relative min-w-0">
              <button
                type="button"
                onClick={() => navigateTab(item.href)}
                className={cn(
                  "relative z-10 flex min-h-12 w-full touch-manipulation flex-col items-center justify-center gap-0.5 px-1 text-[11px] tracking-wide",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className="size-4" strokeWidth={isActive ? 2.25 : 1.75} />
                {item.label}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

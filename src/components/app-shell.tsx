import { APP_NAME } from "@/lib/app"
import { BottomNav } from "@/components/bottom-nav"

export function AppShell({
  householdName,
  children,
}: {
  householdName: string
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
      <header className="flex items-end justify-between gap-4 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3">
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-medium tracking-tight">{APP_NAME}</p>
          <p className="text-xs text-muted-foreground">{householdName}</p>
        </div>
      </header>
      <main className="flex-1 pb-24">{children}</main>
      <BottomNav />
    </div>
  )
}

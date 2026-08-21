"use client"

import { AddTab } from "@/components/add-tab"
import { BottomNav } from "@/components/bottom-nav"
import { HomeTab } from "@/components/home-tab"
import { HouseholdTab } from "@/components/household-tab"
import { InventoryTab } from "@/components/inventory-tab"
import { APP_NAME } from "@/lib/app"
import type { AppTabHref } from "@/lib/app-tabs"
import { AppSessionProvider, useAppSession } from "@/lib/app-session"
import type { HouseholdRole } from "@/lib/supabase/database.types"

function TabPanel({
  href,
  active,
  children,
}: {
  href: AppTabHref
  active: AppTabHref
  children: React.ReactNode
}) {
  const isActive = href === active
  return (
    <div hidden={!isActive} inert={!isActive} aria-hidden={!isActive}>
      {children}
    </div>
  )
}

function AppShellFrame({ children }: { children: React.ReactNode }) {
  const { householdName, clientTabs, activeTab } = useAppSession()
  const showClientTabs = clientTabs && activeTab !== null

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 bg-background/95 px-4 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur-md">
        <p className="text-sm font-semibold tracking-[-0.02em] lowercase">{APP_NAME}</p>
        <p className="max-w-[60%] truncate text-sm text-muted-foreground">{householdName}</p>
      </header>
      <main className="flex-1 pb-24">
        {showClientTabs && activeTab ? (
          <>
            <TabPanel href="/" active={activeTab}>
              <HomeTab />
            </TabPanel>
            <TabPanel href="/inventory" active={activeTab}>
              <InventoryTab />
            </TabPanel>
            <TabPanel href="/add" active={activeTab}>
              <AddTab />
            </TabPanel>
            <TabPanel href="/household" active={activeTab}>
              <HouseholdTab />
            </TabPanel>
          </>
        ) : (
          children
        )}
      </main>
      <BottomNav />
    </div>
  )
}

export function AppShell({
  userId,
  householdId,
  householdName,
  role,
  children,
}: {
  userId: string
  householdId: string
  householdName: string
  role: HouseholdRole
  children: React.ReactNode
}) {
  return (
    <AppSessionProvider
      userId={userId}
      householdId={householdId}
      householdName={householdName}
      role={role}
    >
      <AppShellFrame>{children}</AppShellFrame>
    </AppSessionProvider>
  )
}

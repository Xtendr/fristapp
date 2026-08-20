"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { usePathname } from "next/navigation"

import { isAppTabHref, type AppTabHref } from "@/lib/app-tabs"
import { mapInventoryItem, type InventoryItem } from "@/lib/inventory/item"
import { createClient } from "@/lib/supabase/client"
import type { HouseholdRole } from "@/lib/supabase/database.types"

export type HouseholdMember = {
  user_id: string
  role: HouseholdRole
  profiles: { display_name: string } | { display_name: string }[] | null
}

export type HouseholdInvite = {
  id: string
  expires_at: string
  revoked_at: string | null
}

export type AppSessionValue = {
  userId: string
  householdId: string
  householdName: string
  role: HouseholdRole
  inventory: InventoryItem[] | null
  members: HouseholdMember[] | null
  invites: HouseholdInvite[] | null
  setHouseholdName: (name: string) => void
  refreshInventory: () => Promise<void>
  refreshHousehold: () => Promise<void>
  navigateTab: (href: AppTabHref) => void
  clientTabs: boolean
  activeTab: AppTabHref | null
}

const AppSessionContext = createContext<AppSessionValue | null>(null)

async function loadInventory(householdId: string): Promise<InventoryItem[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("inventory_items")
    .select("id, display_name, quantity, expiry_date, storage_location")
    .eq("household_id", householdId)
    .order("expiry_date", { ascending: true })
    .order("created_at", { ascending: true })

  if (error || !data) {
    return []
  }

  return data.map(mapInventoryItem)
}

async function loadHousehold(
  householdId: string,
  role: HouseholdRole
): Promise<{ members: HouseholdMember[]; invites: HouseholdInvite[] }> {
  const supabase = createClient()
  const isOwner = role === "owner"
  const [membersResult, invitesResult] = await Promise.all([
    supabase
      .from("household_members")
      .select("user_id, role, joined_at, profiles(display_name)")
      .eq("household_id", householdId)
      .order("joined_at", { ascending: true }),
    isOwner
      ? supabase
          .from("household_invites")
          .select("id, expires_at, revoked_at")
          .eq("household_id", householdId)
          .order("expires_at", { ascending: false })
      : Promise.resolve({ data: [] as HouseholdInvite[] }),
  ])

  return {
    members: (membersResult.data ?? []) as HouseholdMember[],
    invites: (invitesResult.data ?? []) as HouseholdInvite[],
  }
}

export function AppSessionProvider({
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
  children: ReactNode
}) {
  const pathname = usePathname()
  const [pendingTab, setPendingTab] = useState<AppTabHref | null>(null)
  const [activeTab, setActiveTab] = useState<AppTabHref | null>(null)
  const [name, setHouseholdName] = useState(householdName)
  const [inventory, setInventory] = useState<InventoryItem[] | null>(null)
  const [members, setMembers] = useState<HouseholdMember[] | null>(null)
  const [invites, setInvites] = useState<HouseholdInvite[] | null>(null)

  if (pendingTab === null && !isAppTabHref(pathname) && activeTab !== null) {
    setActiveTab(null)
  }

  if (isAppTabHref(pathname) && pendingTab === pathname) {
    setPendingTab(null)
  }

  const refreshInventory = useCallback(async () => {
    setInventory(await loadInventory(householdId))
  }, [householdId])

  const refreshHousehold = useCallback(async () => {
    const result = await loadHousehold(householdId, role)
    setMembers(result.members)
    setInvites(result.invites)
  }, [householdId, role])

  const navigateTab = useCallback(
    (href: AppTabHref) => {
      const current = activeTab ?? (isAppTabHref(pathname) ? pathname : null)
      if (current === href) {
        return
      }

      // Visible tab is React state, not Next's pathname. pushState still
      // updates the URL, but Next may ACTION_RESTORE and fetch RSC in the
      // background. That must not choose the panel.
      setPendingTab(href)
      setActiveTab(href)
      if (pathname !== href) {
        window.history.pushState(null, "", href)
      }
    },
    [activeTab, pathname]
  )

  useEffect(() => {
    const onPopState = () => {
      const path = window.location.pathname
      setPendingTab(null)
      setActiveTab(isAppTabHref(path) ? path : null)
    }

    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  useEffect(() => {
    const household = householdId
    void loadInventory(household).then((items) => {
      setInventory(items)
    })
    void loadHousehold(household, role).then((result) => {
      setMembers(result.members)
      setInvites(result.invites)
    })
  }, [householdId, role])

  const clientTabs = activeTab !== null

  const value = useMemo(
    () => ({
      userId,
      householdId,
      householdName: name,
      role,
      inventory,
      members,
      invites,
      setHouseholdName,
      refreshInventory,
      refreshHousehold,
      navigateTab,
      clientTabs,
      activeTab,
    }),
    [
      userId,
      householdId,
      name,
      role,
      inventory,
      members,
      invites,
      refreshInventory,
      refreshHousehold,
      navigateTab,
      clientTabs,
      activeTab,
    ]
  )

  return (
    <AppSessionContext.Provider value={value}>
      {children}
    </AppSessionContext.Provider>
  )
}

export function useAppSession() {
  const value = useContext(AppSessionContext)
  if (!value) {
    throw new Error("useAppSession must be used within AppSessionProvider.")
  }
  return value
}

export function useOptionalAppSession() {
  return useContext(AppSessionContext)
}

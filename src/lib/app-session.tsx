"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  addInventoryItem: (item: InventoryItem) => void
  updateInventoryItem: (item: InventoryItem) => void
  removeInventoryItem: (itemId: string) => void
  refreshInventory: () => Promise<void>
  refreshHousehold: () => Promise<void>
  selectedInventoryItem: InventoryItem | null
  openInventoryItem: (item: InventoryItem) => void
  closeInventoryItem: () => void
  navigateTab: (href: AppTabHref) => void
  clientTabs: boolean
  activeTab: AppTabHref | null
}

const AppSessionContext = createContext<AppSessionValue | null>(null)

function inventoryItemIdFromPath(path: string) {
  const match = path.match(/^\/inventory\/([^/]+)\/edit$/)
  return match?.[1] ? decodeURIComponent(match[1]) : null
}

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
  const inventoryRef = useRef<InventoryItem[] | null>(null)
  const inventoryVersion = useRef(0)
  const [selectedInventoryItem, setSelectedInventoryItem] =
    useState<InventoryItem | null>(null)
  const selectedInventoryItemRef = useRef<InventoryItem | null>(null)
  const selectedInventoryOriginRef = useRef<AppTabHref>("/inventory")
  const [members, setMembers] = useState<HouseholdMember[] | null>(null)
  const [invites, setInvites] = useState<HouseholdInvite[] | null>(null)

  if (
    pendingTab === null &&
    !isAppTabHref(pathname) &&
    !inventoryItemIdFromPath(pathname) &&
    activeTab !== null
  ) {
    setActiveTab(null)
  }

  if (isAppTabHref(pathname) && pendingTab === pathname) {
    setPendingTab(null)
  }

  const refreshInventory = useCallback(async () => {
    const version = inventoryVersion.current
    const items = await loadInventory(householdId)
    if (version === inventoryVersion.current) {
      inventoryRef.current = items
      setInventory(items)
    }
  }, [householdId])

  const addInventoryItem = useCallback((item: InventoryItem) => {
    inventoryVersion.current += 1
    setInventory((current) => {
      const next = [...(current ?? []).filter((entry) => entry.id !== item.id), item]
      const sorted = next.sort((left, right) =>
        left.expiryDate.localeCompare(right.expiryDate)
      )
      inventoryRef.current = sorted
      return sorted
    })
  }, [])

  const updateInventoryItem = useCallback((item: InventoryItem) => {
    addInventoryItem(item)
    setSelectedInventoryItem((current) => {
      if (current?.id !== item.id) return current
      selectedInventoryItemRef.current = item
      return item
    })
  }, [addInventoryItem])

  const removeInventoryItem = useCallback((itemId: string) => {
    inventoryVersion.current += 1
    setInventory((current) => {
      const next = (current ?? []).filter((item) => item.id !== itemId)
      inventoryRef.current = next
      return next
    })
    if (selectedInventoryItemRef.current?.id === itemId) {
      selectedInventoryItemRef.current = null
      setSelectedInventoryItem(null)
    }
  }, [])

  const refreshHousehold = useCallback(async () => {
    const result = await loadHousehold(householdId, role)
    setMembers(result.members)
    setInvites(result.invites)
  }, [householdId, role])

  const openInventoryItem = useCallback(
    (item: InventoryItem) => {
      const currentPath = window.location.pathname
      selectedInventoryOriginRef.current =
        activeTab ?? (isAppTabHref(currentPath) ? currentPath : "/inventory")
      selectedInventoryItemRef.current = item
      setSelectedInventoryItem(item)
      setPendingTab(null)
      setActiveTab("/inventory")

      const href = `/inventory/${encodeURIComponent(item.id)}/edit`
      if (currentPath !== href) {
        window.history.pushState(null, "", href)
      }
    },
    [activeTab]
  )

  const closeInventoryItem = useCallback(() => {
    const wasOpenedInClient = selectedInventoryItemRef.current !== null
    selectedInventoryItemRef.current = null
    setSelectedInventoryItem(null)
    setPendingTab(null)
    setActiveTab(selectedInventoryOriginRef.current)

    if (inventoryItemIdFromPath(window.location.pathname)) {
      if (wasOpenedInClient) {
        window.history.back()
      } else {
        window.history.replaceState(null, "", "/inventory")
      }
    }
  }, [])

  const navigateTab = useCallback(
    (href: AppTabHref) => {
      const current = activeTab ?? (isAppTabHref(pathname) ? pathname : null)
      if (current === href && selectedInventoryItemRef.current === null) {
        return
      }

      // Visible tab is React state, not Next's pathname. pushState still
      // updates the URL, but Next may ACTION_RESTORE and fetch RSC in the
      // background. That must not choose the panel.
      selectedInventoryItemRef.current = null
      setSelectedInventoryItem(null)
      setPendingTab(href)
      setActiveTab(href)
      if (window.location.pathname !== href) {
        window.history.pushState(null, "", href)
      }
    },
    [activeTab, pathname]
  )

  useEffect(() => {
    const onPopState = () => {
      const path = window.location.pathname
      const itemId = inventoryItemIdFromPath(path)
      setPendingTab(null)
      if (itemId) {
        const item = inventoryRef.current?.find((entry) => entry.id === itemId) ?? null
        selectedInventoryOriginRef.current = "/inventory"
        selectedInventoryItemRef.current = item
        setSelectedInventoryItem(item)
        setActiveTab(item ? "/inventory" : null)
        return
      }

      selectedInventoryItemRef.current = null
      setSelectedInventoryItem(null)
      setActiveTab(isAppTabHref(path) ? path : null)
    }

    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  useEffect(() => {
    const household = householdId
    const inventoryLoadVersion = inventoryVersion.current
    void loadInventory(household).then((items) => {
      if (inventoryLoadVersion === inventoryVersion.current) {
        inventoryRef.current = items
        setInventory(items)
      }
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
      addInventoryItem,
      updateInventoryItem,
      removeInventoryItem,
      refreshInventory,
      refreshHousehold,
      selectedInventoryItem,
      openInventoryItem,
      closeInventoryItem,
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
      addInventoryItem,
      updateInventoryItem,
      removeInventoryItem,
      refreshInventory,
      refreshHousehold,
      selectedInventoryItem,
      openInventoryItem,
      closeInventoryItem,
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

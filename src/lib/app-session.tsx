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
import {
  mapHouseholdCategory,
  type HouseholdCategory,
} from "@/lib/categories/types"
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

export type SessionMembership = {
  householdId: string
  householdName: string
  role: HouseholdRole
}

export type NotificationPreferences = {
  householdRemindersEnabled: boolean
  remindThreeDaysBefore: boolean
  remindOneDayBefore: boolean
  remindOnExpiry: boolean
}

export type AppSessionValue = {
  userId: string
  householdId: string
  householdName: string
  role: HouseholdRole
  inventory: InventoryItem[] | null
  members: HouseholdMember[] | null
  invites: HouseholdInvite[] | null
  memberships: SessionMembership[] | null
  categories: HouseholdCategory[] | null
  notificationPreferences: NotificationPreferences | null
  setHouseholdName: (name: string) => void
  addInventoryItem: (item: InventoryItem) => void
  updateInventoryItem: (item: InventoryItem) => void
  removeInventoryItem: (itemId: string) => void
  refreshInventory: () => Promise<void>
  refreshHousehold: () => Promise<void>
  refreshCategories: () => Promise<void>
  setNotificationPreferences: (preferences: NotificationPreferences) => void
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
    .select("id, display_name, quantity, expiry_date, expiry_type, storage_location, product_id, category_id, household_categories(name, icon_key), added_by, profiles!inventory_items_added_by_fkey(display_name)")
    .eq("household_id", householdId)
    .order("expiry_date", { ascending: true })
    .order("created_at", { ascending: true })

  if (error || !data) {
    return []
  }

  return data.map((row) => mapInventoryItem(row as Parameters<typeof mapInventoryItem>[0]))
}

async function loadCategories(householdId: string): Promise<HouseholdCategory[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from("household_categories")
    .select("id, name, system_key, icon_key, sort_order, archived_at")
    .eq("household_id", householdId)
    .is("archived_at", null)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })

  return (data ?? []).map(mapHouseholdCategory)
}

async function loadNotificationPreferences(
  householdId: string
): Promise<NotificationPreferences> {
  const supabase = createClient()
  const { data } = await supabase
    .from("household_notification_preferences")
    .select("household_reminders_enabled, remind_three_days_before, remind_one_day_before, remind_on_expiry")
    .eq("household_id", householdId)
    .maybeSingle()

  return {
    householdRemindersEnabled: data?.household_reminders_enabled ?? true,
    remindThreeDaysBefore: data?.remind_three_days_before ?? true,
    remindOneDayBefore: data?.remind_one_day_before ?? true,
    remindOnExpiry: data?.remind_on_expiry ?? true,
  }
}

async function loadHousehold(
  householdId: string,
  role: HouseholdRole
): Promise<{ members: HouseholdMember[]; invites: HouseholdInvite[]; memberships: SessionMembership[] }> {
  const supabase = createClient()
  const isOwner = role === "owner"
  const [membersResult, invitesResult, membershipsResult] = await Promise.all([
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
    supabase
      .from("household_members")
      .select("household_id, role, households(name)")
      .order("joined_at", { ascending: true }),
  ])

  return {
    members: (membersResult.data ?? []) as HouseholdMember[],
    invites: (invitesResult.data ?? []) as HouseholdInvite[],
    memberships: (membershipsResult.data ?? []).flatMap((membership) => {
      const household = Array.isArray(membership.households) ? membership.households[0] : membership.households
      return household?.name ? [{ householdId: membership.household_id, householdName: household.name, role: membership.role }] : []
    }),
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
  const [memberships, setMemberships] = useState<SessionMembership[] | null>(null)
  const [categories, setCategories] = useState<HouseholdCategory[] | null>(null)
  const [notificationPreferences, setNotificationPreferences] =
    useState<NotificationPreferences | null>(null)

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
    setMemberships(result.memberships)
  }, [householdId, role])

  const refreshCategories = useCallback(async () => {
    setCategories(await loadCategories(householdId))
  }, [householdId])

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
      setMemberships(result.memberships)
    })
    void loadCategories(household).then(setCategories)
    void loadNotificationPreferences(household).then(setNotificationPreferences)
  }, [householdId, role])

  useEffect(() => {
    const refreshVisibleData = () => {
      if (document.visibilityState !== "visible") return
      void refreshInventory()
      void refreshHousehold()
      void refreshCategories()
      void loadNotificationPreferences(householdId).then(setNotificationPreferences)
    }

    document.addEventListener("visibilitychange", refreshVisibleData)
    window.addEventListener("focus", refreshVisibleData)
    return () => {
      document.removeEventListener("visibilitychange", refreshVisibleData)
      window.removeEventListener("focus", refreshVisibleData)
    }
  }, [householdId, refreshCategories, refreshHousehold, refreshInventory])

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
      memberships,
      categories,
      notificationPreferences,
      setHouseholdName,
      addInventoryItem,
      updateInventoryItem,
      removeInventoryItem,
      refreshInventory,
      refreshHousehold,
      refreshCategories,
      setNotificationPreferences,
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
      memberships,
      categories,
      notificationPreferences,
      addInventoryItem,
      updateInventoryItem,
      removeInventoryItem,
      refreshInventory,
      refreshHousehold,
      refreshCategories,
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

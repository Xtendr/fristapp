"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { publicErrorMessage } from "@/lib/auth/errors"
import { getSupabasePublicEnv } from "@/lib/env"
import {
  clearHouseholdCookie,
  setHouseholdCookie,
} from "@/lib/household/cookie"
import { getMemberships } from "@/lib/household/queries"
import { createClient } from "@/lib/supabase/server"

const nameSchema = z
  .string()
  .trim()
  .min(1, "Enter a household name.")
  .max(80, "Use 80 characters or fewer.")

export async function createHousehold(formData: FormData) {
  const parsed = nameSchema.safeParse(String(formData.get("name") ?? ""))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter a household name." }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("create_household", {
    p_name: parsed.data,
  })

  if (error || !data) {
    return { error: publicErrorMessage(error) }
  }

  await setHouseholdCookie(data)
  redirect("/")
}

export async function renameHousehold(formData: FormData) {
  const householdId = String(formData.get("householdId") ?? "")
  const parsed = nameSchema.safeParse(String(formData.get("name") ?? ""))
  if (!householdId) {
    return { error: "Household is missing." }
  }
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter a household name." }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc("rename_household", {
    p_household_id: householdId,
    p_name: parsed.data,
  })

  if (error) {
    return { error: publicErrorMessage(error) }
  }

  revalidatePath("/", "layout")
  revalidatePath("/household")
}

export async function createInvite(
  householdId: string
): Promise<{ error: string } | { url: string }> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("create_invite", {
    p_household_id: householdId,
  })

  if (error || !data) {
    return { error: publicErrorMessage(error) }
  }

  const { appUrl } = getSupabasePublicEnv()
  return { url: `${appUrl.replace(/\/$/, "")}/join/${data}` }
}

export async function revokeInvite(inviteId: string) {
  const supabase = await createClient()
  const { error } = await supabase.rpc("revoke_invite", {
    p_invite_id: inviteId,
  })

  if (error) {
    return { error: publicErrorMessage(error) }
  }

  revalidatePath("/household")
}

export async function acceptInvite(token: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("accept_invite", {
    p_token: token,
  })

  if (error || !data) {
    return { error: publicErrorMessage(error) }
  }

  await setHouseholdCookie(data)
  redirect("/")
}

export async function leaveHousehold(householdId: string) {
  const supabase = await createClient()
  const { error } = await supabase.rpc("leave_household", {
    p_household_id: householdId,
  })

  if (error) {
    return { error: publicErrorMessage(error) }
  }

  await clearHouseholdCookie()

  const remaining = await getMemberships()
  if (remaining.length === 0) {
    redirect("/setup")
  }
  if (remaining.length === 1) {
    await setHouseholdCookie(remaining[0].householdId)
    redirect("/")
  }
  redirect("/select-household")
}

export async function removeMember(householdId: string, userId: string) {
  const supabase = await createClient()
  const { error } = await supabase.rpc("remove_member", {
    p_household_id: householdId,
    p_user_id: userId,
  })

  if (error) {
    return { error: publicErrorMessage(error) }
  }

  revalidatePath("/household")
}

export async function selectHousehold(householdId: string) {
  const memberships = await getMemberships()
  if (!memberships.some((item) => item.householdId === householdId)) {
    redirect("/select-household")
  }

  await setHouseholdCookie(householdId)
  redirect("/")
}

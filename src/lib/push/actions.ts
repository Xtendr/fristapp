"use server"

import { z } from "zod"

import { publicErrorMessage } from "@/lib/auth/errors"
import { getSupabasePublicEnv } from "@/lib/env"
import { createClient } from "@/lib/supabase/server"

const subscriptionSchema = z.object({
  endpoint: z
    .string()
    .url()
    .refine((value) => value.startsWith("https://"), "Endpoint must be HTTPS.")
    .max(2048),
  p256dh: z.string().min(1).max(256),
  auth: z.string().min(1).max(256),
  userAgent: z.string().max(512).optional(),
})

function uniqueViolation(error: { code?: string; message?: string } | null) {
  return error?.code === "23505" || error?.message?.toLowerCase().includes("duplicate")
}

export async function savePushSubscription(input: {
  endpoint: string
  p256dh: string
  auth: string
  userAgent?: string
}): Promise<{ error: string } | { ok: true } | { error: "subscription_taken" }> {
  const parsed = subscriptionSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid subscription." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Sign in to enable notifications." }
  }

  const row = {
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.p256dh,
    auth: parsed.data.auth,
    user_agent: parsed.data.userAgent ?? null,
  }

  const inserted = await supabase.from("push_subscriptions").insert(row)
  if (!inserted.error) {
    return { ok: true }
  }

  if (!uniqueViolation(inserted.error)) {
    return { error: publicErrorMessage(inserted.error) }
  }

  const existing = await supabase
    .from("push_subscriptions")
    .select("id")
    .eq("endpoint", parsed.data.endpoint)
    .maybeSingle()

  if (!existing.data) {
    return { error: "subscription_taken" }
  }

  const updated = await supabase
    .from("push_subscriptions")
    .update({
      p256dh: parsed.data.p256dh,
      auth: parsed.data.auth,
      user_agent: parsed.data.userAgent ?? null,
    })
    .eq("id", existing.data.id)

  if (updated.error) {
    return { error: publicErrorMessage(updated.error) }
  }

  return { ok: true }
}

export async function deletePushSubscription(endpoint: string): Promise<{ error: string } | { ok: true }> {
  const parsed = z.string().url().max(2048).safeParse(endpoint)
  if (!parsed.success) {
    return { error: "Invalid subscription." }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", parsed.data)

  if (error) {
    return { error: publicErrorMessage(error) }
  }

  return { ok: true }
}

export async function sendTestPushNotification(): Promise<{ error: string } | { ok: true }> {
  const { url } = getSupabasePublicEnv()
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.access_token) {
    return { error: "Sign in to send a test notification." }
  }

  const response = await fetch(`${url}/functions/v1/push-dispatch`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  })

  const payload = (await response.json().catch(() => null)) as
    | { ok?: boolean; error?: string; sent?: number }
    | null

  if (!response.ok || !payload?.ok) {
    return {
      error: payload?.error ?? "Could not send a test notification.",
    }
  }

  return { ok: true }
}

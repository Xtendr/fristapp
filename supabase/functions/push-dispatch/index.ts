import { createClient } from "npm:@supabase/supabase-js@2"

import {
  addCalendarDays,
  calendarDaysUntil,
  isCopenhagenDispatchHour,
  isReminderOffset,
  reminderCopy,
  todayInCopenhagen,
  type ReminderOffset,
} from "../_shared/copenhagen.ts"
import { sendWebPush } from "./send.ts"

type DispatchBody = {
  ignoreScheduleWindow?: boolean
}

type SubscriptionRow = {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
}

type ItemRow = {
  id: string
  household_id: string
  display_name: string
  expiry_date: string
}

type MemberRow = {
  household_id: string
  user_id: string
}

type DeliveryRow = {
  inventory_item_id: string
  push_subscription_id: string
  reminder_offset: number
  expiry_date: string
}

const TEST_PAYLOAD = {
  title: "Frist test",
  body: "Notifications are working.",
  url: "/",
  tag: "frist-test",
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function bearerToken(req: Request): string | null {
  const header = req.headers.get("Authorization") ?? ""
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  return match?.[1]?.trim() || null
}

function secrets() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  const cronSecret = Deno.env.get("CRON_SECRET")
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:frist@localhost"

  if (!supabaseUrl || !serviceRoleKey || !cronSecret || !vapidPrivateKey) {
    throw new Error("Missing Edge Function secrets.")
  }

  return { supabaseUrl, serviceRoleKey, cronSecret, vapidPrivateKey, vapidSubject }
}

function timingSafeEqual(left: string, right: string) {
  const encoder = new TextEncoder()
  const a = encoder.encode(left)
  const b = encoder.encode(right)
  if (a.byteLength !== b.byteLength) {
    return false
  }
  let mismatch = 0
  for (let i = 0; i < a.byteLength; i += 1) {
    mismatch |= a[i] ^ b[i]
  }
  return mismatch === 0
}

function adminClient(url: string, serviceRoleKey: string) {
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function userFromJwt(url: string, serviceRoleKey: string, token: string) {
  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) {
    return null
  }
  return data.user
}

async function deleteDeadSubscription(
  admin: ReturnType<typeof adminClient>,
  subscriptionId: string
) {
  await admin.from("push_subscriptions").delete().eq("id", subscriptionId)
}

async function markSuccess(
  admin: ReturnType<typeof adminClient>,
  subscriptionId: string
) {
  await admin
    .from("push_subscriptions")
    .update({ last_success_at: new Date().toISOString() })
    .eq("id", subscriptionId)
}

async function sendToSubscription(options: {
  admin: ReturnType<typeof adminClient>
  subscription: SubscriptionRow
  payload: Record<string, string>
  vapidPrivateKey: string
  vapidSubject: string
}) {
  const result = await sendWebPush({
    subscription: options.subscription,
    payload: options.payload,
    vapidPrivateKey: options.vapidPrivateKey,
    vapidSubject: options.vapidSubject,
  })

  if (result.gone) {
    await deleteDeadSubscription(options.admin, options.subscription.id)
    return "gone" as const
  }

  if (result.status >= 200 && result.status < 300) {
    await markSuccess(options.admin, options.subscription.id)
    return "sent" as const
  }

  return "failed" as const
}

async function dispatchTest(options: {
  admin: ReturnType<typeof adminClient>
  userId: string
  vapidPrivateKey: string
  vapidSubject: string
}) {
  const { data: subscriptions, error } = await options.admin
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .eq("user_id", options.userId)

  if (error) {
    return json(500, { ok: false, error: "Could not load subscriptions." })
  }

  const rows = (subscriptions ?? []) as SubscriptionRow[]
  if (rows.length === 0) {
    return json(400, { ok: false, error: "No notification subscription on this account." })
  }

  let sent = 0
  let failed = 0
  let gone = 0

  for (const subscription of rows) {
    const outcome = await sendToSubscription({
      admin: options.admin,
      subscription,
      payload: TEST_PAYLOAD,
      vapidPrivateKey: options.vapidPrivateKey,
      vapidSubject: options.vapidSubject,
    })
    if (outcome === "sent") sent += 1
    else if (outcome === "gone") gone += 1
    else failed += 1
  }

  return json(200, { ok: sent > 0, mode: "test", sent, failed, gone })
}

async function dispatchReminders(options: {
  admin: ReturnType<typeof adminClient>
  vapidPrivateKey: string
  vapidSubject: string
}) {
  const today = todayInCopenhagen()
  const dueDates = [0, 1, 3].map((offset) => addCalendarDays(today, offset))

  const { data: items, error: itemsError } = await options.admin
    .from("inventory_items")
    .select("id, household_id, display_name, expiry_date")
    .in("expiry_date", dueDates)

  if (itemsError) {
    return json(500, { ok: false, error: "Could not load inventory." })
  }

  const itemRows = (items ?? []) as ItemRow[]
  if (itemRows.length === 0) {
    return json(200, { ok: true, mode: "cron", sent: 0, failed: 0, skipped: 0 })
  }

  const householdIds = [...new Set(itemRows.map((item) => item.household_id))]
  const { data: members, error: membersError } = await options.admin
    .from("household_members")
    .select("household_id, user_id")
    .in("household_id", householdIds)

  if (membersError) {
    return json(500, { ok: false, error: "Could not load household members." })
  }

  const memberRows = (members ?? []) as MemberRow[]
  const userIds = [...new Set(memberRows.map((member) => member.user_id))]
  if (userIds.length === 0) {
    return json(200, { ok: true, mode: "cron", sent: 0, failed: 0, skipped: 0 })
  }

  const { data: subscriptions, error: subsError } = await options.admin
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .in("user_id", userIds)

  if (subsError) {
    return json(500, { ok: false, error: "Could not load subscriptions." })
  }

  const subscriptionRows = (subscriptions ?? []) as SubscriptionRow[]
  const itemIds = itemRows.map((item) => item.id)

  const { data: deliveries, error: deliveriesError } = await options.admin
    .from("notification_deliveries")
    .select("inventory_item_id, push_subscription_id, reminder_offset, expiry_date")
    .in("inventory_item_id", itemIds)

  if (deliveriesError) {
    return json(500, { ok: false, error: "Could not load deliveries." })
  }

  const delivered = new Set(
    ((deliveries ?? []) as DeliveryRow[]).map(
      (row) =>
        `${row.inventory_item_id}:${row.push_subscription_id}:${row.reminder_offset}:${row.expiry_date}`
    )
  )

  const membersByHousehold = new Map<string, string[]>()
  for (const member of memberRows) {
    const list = membersByHousehold.get(member.household_id) ?? []
    list.push(member.user_id)
    membersByHousehold.set(member.household_id, list)
  }

  const subscriptionsByUser = new Map<string, SubscriptionRow[]>()
  for (const subscription of subscriptionRows) {
    const list = subscriptionsByUser.get(subscription.user_id) ?? []
    list.push(subscription)
    subscriptionsByUser.set(subscription.user_id, list)
  }

  let sent = 0
  let failed = 0
  let skipped = 0

  for (const item of itemRows) {
    const offset = calendarDaysUntil(item.expiry_date, today)
    if (!isReminderOffset(offset)) {
      continue
    }

    const memberIds = membersByHousehold.get(item.household_id) ?? []
    const copy = reminderCopy(item.display_name, offset)
    const payload = {
      title: copy.title,
      body: copy.body,
      url: "/",
      tag: `expiry-${item.id}-${offset}`,
    }

    for (const userId of memberIds) {
      const userSubs = subscriptionsByUser.get(userId) ?? []
      for (const subscription of userSubs) {
        const key = `${item.id}:${subscription.id}:${offset}:${item.expiry_date}`
        if (delivered.has(key)) {
          skipped += 1
          continue
        }

        const outcome = await sendToSubscription({
          admin: options.admin,
          subscription,
          payload,
          vapidPrivateKey: options.vapidPrivateKey,
          vapidSubject: options.vapidSubject,
        })

        if (outcome !== "sent") {
          if (outcome === "failed") failed += 1
          continue
        }

        const { error: insertError } = await options.admin
          .from("notification_deliveries")
          .insert({
            inventory_item_id: item.id,
            user_id: userId,
            push_subscription_id: subscription.id,
            reminder_offset: offset as ReminderOffset,
            expiry_date: item.expiry_date,
          })

        if (insertError) {
          failed += 1
          continue
        }

        delivered.add(key)
        sent += 1
      }
    }
  }

  return json(200, { ok: true, mode: "cron", sent, failed, skipped })
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json(405, { ok: false, error: "Method not allowed." })
  }

  let env: ReturnType<typeof secrets>
  try {
    env = secrets()
  } catch (error) {
    return json(500, {
      ok: false,
      error: error instanceof Error ? error.message : "Missing secrets.",
    })
  }

  const token = bearerToken(req)
  if (!token) {
    return json(401, { ok: false, error: "Missing authorization." })
  }

  let body: DispatchBody = {}
  try {
    const text = await req.text()
    if (text.trim()) {
      body = JSON.parse(text) as DispatchBody
    }
  } catch {
    return json(400, { ok: false, error: "Invalid JSON." })
  }

  const admin = adminClient(env.supabaseUrl, env.serviceRoleKey)

  if (timingSafeEqual(token, env.cronSecret)) {
    if (!body.ignoreScheduleWindow && !isCopenhagenDispatchHour()) {
      return json(200, {
        ok: true,
        mode: "cron",
        skippedHour: true,
        sent: 0,
      })
    }
    return await dispatchReminders({
      admin,
      vapidPrivateKey: env.vapidPrivateKey,
      vapidSubject: env.vapidSubject,
    })
  }

  const user = await userFromJwt(env.supabaseUrl, env.serviceRoleKey, token)
  if (!user) {
    return json(401, { ok: false, error: "Unauthorized." })
  }

  return await dispatchTest({
    admin,
    userId: user.id,
    vapidPrivateKey: env.vapidPrivateKey,
    vapidSubject: env.vapidSubject,
  })
})

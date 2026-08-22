"use server"

import { z } from "zod"

import { publicErrorMessage } from "@/lib/auth/errors"
import { getSessionHousehold } from "@/lib/household/session"
import { createClient } from "@/lib/supabase/server"

const preferenceSchema = z.object({
  householdRemindersEnabled: z.boolean(),
  remindThreeDaysBefore: z.boolean(),
  remindOneDayBefore: z.boolean(),
  remindOnExpiry: z.boolean(),
})

export type ReminderPreferenceInput = z.infer<typeof preferenceSchema>

export async function saveReminderPreferences(input: ReminderPreferenceInput) {
  const parsed = preferenceSchema.safeParse(input)
  if (!parsed.success) return { error: "Reminder settings are invalid." }
  const session = await getSessionHousehold()
  if (!session.userId || session.household.status !== "ready") return { error: "Household is missing." }

  const supabase = await createClient()
  const { error } = await supabase.from("household_notification_preferences").upsert({
    household_id: session.household.current.householdId,
    household_reminders_enabled: parsed.data.householdRemindersEnabled,
    remind_three_days_before: parsed.data.remindThreeDaysBefore,
    remind_one_day_before: parsed.data.remindOneDayBefore,
    remind_on_expiry: parsed.data.remindOnExpiry,
  }, { onConflict: "household_id,user_id" })

  return error ? { error: publicErrorMessage(error) } : { saved: true as const }
}

"use client"

import { useTransition } from "react"
import { toast } from "sonner"

import { useAppSession, type NotificationPreferences } from "@/lib/app-session"
import { saveReminderPreferences } from "@/lib/push/preferences"

const options: Array<{ key: keyof NotificationPreferences; label: string }> = [
  { key: "remindThreeDaysBefore", label: "Three days before" },
  { key: "remindOneDayBefore", label: "One day before" },
  { key: "remindOnExpiry", label: "On the expiry day" },
]

export function ReminderPreferences() {
  const { notificationPreferences, setNotificationPreferences } = useAppSession()
  const [pending, startTransition] = useTransition()
  if (!notificationPreferences) return null

  function change(next: NotificationPreferences) {
    const previous = notificationPreferences!
    setNotificationPreferences(next)
    startTransition(async () => {
      const result = await saveReminderPreferences(next)
      if ("error" in result) {
        setNotificationPreferences(previous)
        toast.error(result.error)
      }
    })
  }

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="type-section">Reminder schedule</h2>
        <p className="mt-1 type-body-secondary">These choices are personal to you in this household.</p>
      </div>
      <label className="flex min-h-12 items-center justify-between gap-3 rounded-lg border bg-card px-3 text-sm font-medium">
        Household reminders
        <input type="checkbox" checked={notificationPreferences.householdRemindersEnabled} disabled={pending} onChange={(event) => change({ ...notificationPreferences, householdRemindersEnabled: event.target.checked })} className="size-5 accent-foreground" />
      </label>
      <div className="rounded-xl border bg-card px-3">
        {options.map((option) => (
          <label key={option.key} className="flex min-h-12 items-center justify-between gap-3 border-b border-border text-sm last:border-b-0">
            {option.label}
            <input type="checkbox" checked={notificationPreferences[option.key]} disabled={pending || !notificationPreferences.householdRemindersEnabled} onChange={(event) => change({ ...notificationPreferences, [option.key]: event.target.checked })} className="size-5 accent-foreground" />
          </label>
        ))}
      </div>
    </section>
  )
}

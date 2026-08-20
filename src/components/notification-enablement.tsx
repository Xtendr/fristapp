"use client"

import { useEffect, useState, useSyncExternalStore, useTransition } from "react"

import { Button } from "@/components/ui/button"
import { sendTestPushNotification } from "@/lib/push/actions"
import { getPushInstallState } from "@/lib/push/capability"
import {
  getBrowserPushSubscription,
  subscribeBrowserPush,
  unsubscribeBrowserPush,
} from "@/lib/push/browser"

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

function subscribeNever() {
  return () => {}
}

export function NotificationEnablement({
  variant,
}: {
  variant: "home" | "household"
}) {
  const installState = useSyncExternalStore(
    subscribeNever,
    () => getPushInstallState(vapidPublicKey),
    () => null
  )
  const detectedPermission = useSyncExternalStore(
    subscribeNever,
    () => ("Notification" in window ? Notification.permission : "unknown"),
    () => "unknown" as const
  )
  const [permissionOverride, setPermissionOverride] =
    useState<NotificationPermission | null>(null)
  const permission = permissionOverride ?? detectedPermission
  const [subscribed, setSubscribed] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    void getBrowserPushSubscription()
      .then((subscription) => setSubscribed(Boolean(subscription)))
      .catch(() => setSubscribed(false))

    const onPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }

    window.addEventListener("beforeinstallprompt", onPrompt)
    return () => window.removeEventListener("beforeinstallprompt", onPrompt)
  }, [])

  const enable = () => {
    setMessage(null)
    startTransition(async () => {
      if (!vapidPublicKey) {
        setMessage("Notifications are not configured yet.")
        return
      }

      const result = await Notification.requestPermission()
      setPermissionOverride(result)
      if (result !== "granted") {
        setMessage("Notifications are off. You can enable them later in system settings.")
        return
      }

      const saved = await subscribeBrowserPush(vapidPublicKey)
      if (saved === "taken") {
        setMessage("Could not take over this device's subscription. Try again.")
        return
      }
      if ("error" in saved) {
        setMessage(saved.error)
        return
      }

      setSubscribed(true)
    })
  }

  const disable = () => {
    setMessage(null)
    startTransition(async () => {
      await unsubscribeBrowserPush()
      setSubscribed(false)
    })
  }

  const sendTest = () => {
    setMessage(null)
    startTransition(async () => {
      const result = await sendTestPushNotification()
      if ("error" in result) {
        setMessage(result.error)
        return
      }
      setMessage("Test notification sent.")
    })
  }

  const installAndroid = () => {
    if (!installPrompt) {
      return
    }
    startTransition(async () => {
      await installPrompt.prompt()
      setInstallPrompt(null)
    })
  }

  if (!installState) {
    return null
  }

  if (installState === "not-configured") {
    if (variant === "home") {
      return null
    }
    return (
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Notifications</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Push notifications are not configured on this deployment yet.
        </p>
      </section>
    )
  }

  if (installState === "unsupported" || installState === "insecure") {
    if (variant === "home") {
      return null
    }
    return (
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Notifications</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          This browser cannot receive Frist reminders. Use an installed Frist app
          on iPhone, or Chrome on Android.
        </p>
      </section>
    )
  }

  if (installState === "ios-browser") {
    return (
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Notifications</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          On iPhone, add Frist to the Home Screen first. Tap Share, then Add to
          Home Screen. Open Frist from that icon, then enable notifications.
        </p>
      </section>
    )
  }

  if (permission === "denied") {
    if (variant === "home") {
      return null
    }
    return (
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Notifications</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Notifications are off. You can enable them in system settings for Frist.
        </p>
      </section>
    )
  }

  if (subscribed) {
    if (variant === "home") {
      return null
    }
    return (
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Notifications</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Reminders are on for this device. Frist can notify you before food
          expires, even if the app is closed.
        </p>
        <div className="flex flex-wrap gap-2">
          {variant === "household" ? (
            <Button type="button" variant="outline" disabled={pending} onClick={sendTest}>
              {pending ? "Working" : "Send test notification"}
            </Button>
          ) : null}
          <Button type="button" variant="ghost" disabled={pending} onClick={disable}>
            Turn off on this device
          </Button>
        </div>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium">Notifications</h2>
      <p className="text-sm leading-6 text-muted-foreground">
        Get a reminder before food expires. Frist asks the browser only after you
        tap Enable.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={pending} onClick={enable}>
          {pending ? "Working" : "Enable notifications"}
        </Button>
        {installPrompt ? (
          <Button type="button" variant="outline" disabled={pending} onClick={installAndroid}>
            Install Frist
          </Button>
        ) : null}
      </div>
      {message ? <p className="text-sm text-destructive">{message}</p> : null}
    </section>
  )
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
}

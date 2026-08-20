import {
  deletePushSubscription,
  savePushSubscription,
} from "@/lib/push/actions"
import { vapidPublicKeyBytes } from "@/lib/push/vapid"

export async function getBrowserPushSubscription() {
  if (!("serviceWorker" in navigator)) {
    return null
  }

  const registration = await navigator.serviceWorker.getRegistration()
  if (!registration) {
    return null
  }

  return registration.pushManager.getSubscription()
}

export async function subscribeBrowserPush(vapidPublicKey: string) {
  const registration = await navigator.serviceWorker.register("/sw.js")
  await navigator.serviceWorker.ready

  let subscription = await registration.pushManager.getSubscription()
  if (subscription) {
    const saved = await persistSubscription(subscription)
    if (saved !== "taken") {
      return saved
    }
    await subscription.unsubscribe()
    subscription = null
  }

  subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: vapidPublicKeyBytes(vapidPublicKey),
  })

  return persistSubscription(subscription)
}

async function persistSubscription(subscription: PushSubscription) {
  const json = subscription.toJSON()
  const endpoint = json.endpoint
  const p256dh = json.keys?.p256dh
  const auth = json.keys?.auth

  if (!endpoint || !p256dh || !auth) {
    await subscription.unsubscribe().catch(() => undefined)
    return { error: "The browser did not return a complete push subscription." }
  }

  const result = await savePushSubscription({
    endpoint,
    p256dh,
    auth,
    userAgent: navigator.userAgent,
  })

  if ("error" in result && result.error === "subscription_taken") {
    return "taken" as const
  }

  return result
}

export async function unsubscribeBrowserPush() {
  try {
    const registration = await navigator.serviceWorker.getRegistration()
    const subscription = await registration?.pushManager.getSubscription()
    if (!subscription) {
      return
    }

    await deletePushSubscription(subscription.endpoint)
    await subscription.unsubscribe()
  } catch {
    // Sign-out and disable paths should still continue.
  }
}

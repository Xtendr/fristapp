// Stable service-worker path for Phase 2 Web Push.
// No fetch handler, caching, or offline-first behavior.

self.addEventListener("install", () => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener("push", (event) => {
  event.waitUntil(showPushNotification(event))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || "/"
  event.waitUntil(openOrFocus(targetUrl))
})

async function showPushNotification(event) {
  let payload = {
    title: "Frist",
    body: "Something in the household needs attention.",
    url: "/",
    tag: "frist",
  }

  try {
    if (event.data) {
      const parsed = event.data.json()
      payload = {
        title: parsed.title || payload.title,
        body: parsed.body || payload.body,
        url: parsed.url || payload.url,
        tag: parsed.tag || payload.tag,
      }
    }
  } catch {
    // Still show a notification. Safari revokes permission if a push is silent.
  }

  await self.registration.showNotification(payload.title, {
    body: payload.body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: payload.tag,
    data: { url: payload.url },
  })
}

async function openOrFocus(url) {
  const windows = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  })

  for (const client of windows) {
    if ("focus" in client) {
      await client.focus()
      return
    }
  }

  await self.clients.openWindow(url)
}

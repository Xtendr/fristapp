import { buildPushHTTPRequest } from "npm:@pushforge/builder@2.0.5"

export type PushSubscriptionRecord = {
  endpoint: string
  p256dh: string
  auth: string
}

export type PushSendResult = {
  status: number
  gone: boolean
}

export function parsePrivateJwk(raw: string): JsonWebKey {
  let trimmed = raw.trim().replace(/^\uFEFF/, "").replace(/\r/g, "")
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    trimmed = trimmed.slice(1, -1)
  }
  if (!trimmed.startsWith("{")) {
    throw new Error("VAPID_PRIVATE_KEY must be the JWK JSON from `npx @pushforge/builder vapid`.")
  }
  try {
    return JSON.parse(trimmed) as JsonWebKey
  } catch {
    throw new Error("VAPID_PRIVATE_KEY is not valid JWK JSON.")
  }
}

export async function sendWebPush(options: {
  subscription: PushSubscriptionRecord
  payload: Record<string, string>
  vapidPrivateKey: string
  vapidSubject: string
}): Promise<PushSendResult> {
  const { endpoint, headers, body } = await buildPushHTTPRequest({
    privateJWK: parsePrivateJwk(options.vapidPrivateKey),
    subscription: {
      endpoint: options.subscription.endpoint,
      keys: {
        p256dh: options.subscription.p256dh,
        auth: options.subscription.auth,
      },
    },
    message: {
      payload: options.payload,
      adminContact: options.vapidSubject,
      options: {
        ttl: 86_400,
        urgency: "normal",
      },
    },
  })

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body,
  })

  const status = response.status
  if (status < 200 || status >= 300) {
    const detail = (await response.text().catch(() => "")).slice(0, 180)
    console.error("web-push-failed", { status, detail })
  }

  return {
    status,
    gone: status === 404 || status === 410,
  }
}

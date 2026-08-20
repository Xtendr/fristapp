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

function parsePrivateJwk(raw: string): JsonWebKey {
  const trimmed = raw.trim()
  if (trimmed.startsWith("{")) {
    return JSON.parse(trimmed) as JsonWebKey
  }
  throw new Error("VAPID_PRIVATE_KEY must be the JWK JSON from `npx @pushforge/builder vapid`.")
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

  return {
    status: response.status,
    gone: response.status === 404 || response.status === 410,
  }
}

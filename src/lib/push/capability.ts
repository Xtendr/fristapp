export type PushInstallState =
  | "unsupported"
  | "insecure"
  | "not-configured"
  | "ios-browser"
  | "supported"

function isIosDevice() {
  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/.test(ua)) {
    return true
  }

  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1
}

export function isStandaloneDisplay() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  )
}

export function getPushInstallState(vapidPublicKey: string | undefined): PushInstallState {
  if (!vapidPublicKey) {
    return "not-configured"
  }

  if (!window.isSecureContext) {
    return "insecure"
  }

  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    if (isIosDevice() && !isStandaloneDisplay()) {
      return "ios-browser"
    }
    return "unsupported"
  }

  if (isIosDevice() && !isStandaloneDisplay()) {
    return "ios-browser"
  }

  return "supported"
}

export const HOUSEHOLD_COOKIE = "frist_household_id"

export function safeAuthNextPath(value: string | null | undefined) {
  if (!value) {
    return null
  }

  if (!value.startsWith("/join/")) {
    return null
  }

  if (value.includes("//") || value.includes("\\") || value.includes("..")) {
    return null
  }

  return value
}

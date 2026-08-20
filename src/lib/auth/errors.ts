import { AuthError } from "@supabase/supabase-js"

export function authErrorMessage(error: AuthError | null | undefined) {
  const message = error?.message ?? ""
  const normalized = message.toLowerCase()

  if (normalized.includes("invalid login credentials")) {
    return "Email or password is incorrect."
  }

  if (
    normalized.includes("already registered") ||
    normalized.includes("user already registered")
  ) {
    return "An account with this email already exists. Sign in instead."
  }

  if (normalized.includes("password")) {
    return "Use a password that is at least 8 characters."
  }

  if (normalized.includes("email")) {
    return "Enter a valid email address."
  }

  return message || "Something went wrong. Try again."
}

export function publicErrorMessage(error: { message?: string } | null | undefined) {
  return error?.message?.trim() || "Something went wrong. Try again."
}

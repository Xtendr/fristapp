"use server"

import { redirect } from "next/navigation"
import { z } from "zod"

import { authErrorMessage } from "@/lib/auth/errors"
import { safeAuthNextPath } from "@/lib/paths"
import { createClient } from "@/lib/supabase/server"

const credentialsSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Use a password that is at least 8 characters."),
  displayName: z.string().trim().max(80).optional(),
  next: z.string().optional(),
})

function formValues(formData: FormData) {
  return credentialsSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    displayName: String(formData.get("displayName") ?? ""),
    next: String(formData.get("next") ?? ""),
  })
}

function destination(next: string | undefined) {
  return safeAuthNextPath(next) ?? "/"
}

export async function signIn(formData: FormData) {
  const parsed = formValues(formData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) {
    return { error: authErrorMessage(error) }
  }

  redirect(destination(parsed.data.next))
}

export async function signUp(formData: FormData) {
  const parsed = formValues(formData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." }
  }

  const supabase = await createClient()
  const displayName = parsed.data.displayName?.trim()
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: displayName ? { display_name: displayName } : {},
    },
  })

  if (error) {
    return { error: authErrorMessage(error) }
  }

  redirect(destination(parsed.data.next))
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/sign-in")
}

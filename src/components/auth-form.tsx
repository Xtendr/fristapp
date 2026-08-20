"use client"

import { useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { signIn, signUp } from "@/lib/auth/actions"

export function AuthForm({
  mode,
  nextPath,
}: {
  mode: "sign-in" | "sign-up"
  nextPath?: string | null
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    setError(null)
    startTransition(async () => {
      const result =
        mode === "sign-in" ? await signIn(formData) : await signUp(formData)
      if (result?.error) {
        setError(result.error)
      }
    })
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
      <FieldGroup>
        {mode === "sign-up" ? (
          <Field>
            <FieldLabel htmlFor="displayName">Name</FieldLabel>
            <Input
              id="displayName"
              name="displayName"
              autoComplete="name"
              maxLength={80}
            />
          </Field>
        ) : null}
        <Field data-invalid={error ? true : undefined}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            aria-invalid={error ? true : undefined}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={
              mode === "sign-in" ? "current-password" : "new-password"
            }
            minLength={8}
            required
          />
        </Field>
      </FieldGroup>
      {error ? <FieldError>{error}</FieldError> : null}
      <Button type="submit" disabled={pending}>
        {pending
          ? "Please wait"
          : mode === "sign-in"
            ? "Sign in"
            : "Create account"}
      </Button>
    </form>
  )
}

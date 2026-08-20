import Link from "next/link"

import { AuthChrome } from "@/components/auth-chrome"
import { AuthForm } from "@/components/auth-form"
import { safeAuthNextPath } from "@/lib/paths"

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams
  const nextPath = safeAuthNextPath(next)

  return (
    <AuthChrome
      title="Create account"
      description="Email and password only. You can create or join a household next."
    >
      <AuthForm mode="sign-up" nextPath={nextPath} />
      <p className="mt-6 text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href={nextPath ? `/sign-in?next=${encodeURIComponent(nextPath)}` : "/sign-in"}
          className="text-foreground underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </AuthChrome>
  )
}

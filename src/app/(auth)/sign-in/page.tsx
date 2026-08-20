import Link from "next/link"

import { AuthChrome } from "@/components/auth-chrome"
import { AuthForm } from "@/components/auth-form"
import { safeAuthNextPath } from "@/lib/paths"

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams
  const nextPath = safeAuthNextPath(next)

  return (
    <AuthChrome
      title="Sign in"
      description="Use the email and password for your Frist account."
    >
      <AuthForm mode="sign-in" nextPath={nextPath} />
      <p className="mt-6 text-sm text-muted-foreground">
        No account yet?{" "}
        <Link
          href={nextPath ? `/sign-up?next=${encodeURIComponent(nextPath)}` : "/sign-up"}
          className="text-foreground underline-offset-4 hover:underline"
        >
          Create one
        </Link>
      </p>
    </AuthChrome>
  )
}

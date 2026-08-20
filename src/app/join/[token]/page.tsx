import Link from "next/link"

import { AcceptInviteButton } from "@/components/accept-invite-button"
import { AuthChrome } from "@/components/auth-chrome"
import { getUserId } from "@/lib/household/queries"
import { createClient } from "@/lib/supabase/server"
import type { InvitePreviewStatus } from "@/lib/supabase/database.types"

export const dynamic = "force-dynamic"

function statusCopy(status: InvitePreviewStatus, householdName: string | null) {
  if (status === "valid" && householdName) {
    return {
      title: `Join ${householdName}`,
      description: "This invite is valid. Sign in or create an account if you have not already, then join.",
    }
  }
  if (status === "expired") {
    return {
      title: "Invite expired",
      description: "Ask a household owner for a new link.",
    }
  }
  if (status === "revoked") {
    return {
      title: "Invite revoked",
      description: "This link is no longer valid. Ask a household owner for a new one.",
    }
  }
  return {
    title: "Invite not found",
    description: "This link is invalid. Check that it was copied in full.",
  }
}

export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("get_invite_preview", {
    p_token: token,
  })

  const preview = Array.isArray(data) ? data[0] : data
  const status = (preview?.status ?? "unknown") as InvitePreviewStatus
  const copy = statusCopy(
    error ? "unknown" : status,
    preview?.household_name ?? null
  )
  const userId = await getUserId()
  const nextPath = `/join/${token}`

  return (
    <AuthChrome title={copy.title} description={copy.description}>
      {status === "valid" ? (
        userId ? (
          <AcceptInviteButton token={token} />
        ) : (
          <div className="flex flex-col gap-3 text-sm">
            <Link
              href={`/sign-in?next=${encodeURIComponent(nextPath)}`}
              className="text-foreground underline-offset-4 hover:underline"
            >
              Sign in to join
            </Link>
            <Link
              href={`/sign-up?next=${encodeURIComponent(nextPath)}`}
              className="text-foreground underline-offset-4 hover:underline"
            >
              Create an account to join
            </Link>
          </div>
        )
      ) : null}
    </AuthChrome>
  )
}

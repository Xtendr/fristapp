import { redirect } from "next/navigation"

import { getUserId } from "@/lib/household/queries"

export const dynamic = "force-dynamic"

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const userId = await getUserId()
  if (userId) {
    redirect("/")
  }

  return children
}

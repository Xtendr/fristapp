import { createBrowserClient } from "@supabase/ssr"

import { getSupabasePublicEnv } from "@/lib/env"
import type { Database } from "@/lib/supabase/database.types"

export function createClient() {
  const { url, publishableKey } = getSupabasePublicEnv()

  return createBrowserClient<Database>(url, publishableKey)
}

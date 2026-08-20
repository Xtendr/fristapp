import { z } from "zod"

const supabasePublicSchema = z.object({
  url: z.string().url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  publishableKey: z
    .string()
    .min(1, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required"),
  appUrl: z.string().url("NEXT_PUBLIC_APP_URL must be a valid URL"),
})

export type SupabasePublicEnv = z.infer<typeof supabasePublicSchema>

/**
 * Required as soon as any runtime path creates a Supabase client.
 * Missing values fail loudly so features cannot silently skip Auth/RLS.
 */
export function getSupabasePublicEnv(): SupabasePublicEnv {
  const parsed = supabasePublicSchema.safeParse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
  })

  if (!parsed.success) {
    throw new Error(
      "Missing required configuration. Copy .env.example to .env.local and set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, and NEXT_PUBLIC_APP_URL."
    )
  }

  return parsed.data
}
